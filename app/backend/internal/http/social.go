package httpserver

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"

	"ki-web/backend/internal/api"
	"ki-web/backend/internal/linkedin"
	"ki-web/backend/internal/service"
)

// LinkedIn-Einstellungen und Teilen (Ticket #85). Sitzung, Admin-Rolle und CSRF-Token prüft guard vorab
// (unbekannte /api/admin-Pfade sind Admins vorbehalten, siehe allowed). Die Wiederholung unter /api/admin/posts
// steht der Redaktion offen.

// linkedInSettingsPage ist die Einstellungsseite, zu der der OAuth-Rückruf zurückführt.
const linkedInSettingsPage = "/redaktion/einstellungen/social-media/linkedin"

// oauthStateTTL begrenzt, wie lange eine begonnene Autorisierung gilt.
const oauthStateTTL = 10 * time.Minute

// LinkedInOAuth ist der Teil des LinkedIn-Clients für die Verbindung per OAuth.
type LinkedInOAuth interface {
	Configured() bool
	AuthorizationURL(state string) string
	Exchange(ctx context.Context, code string) (linkedin.Token, error)
	Profile(ctx context.Context, token string) (linkedin.Profile, error)
}

// oauthStates merkt sich begonnene Autorisierungen: zufälliger state, gebunden an das Konto, einmalig und
// zeitlich begrenzt (REQ-85-AC2). Die Anwendung läuft als ein Prozess; der Arbeitsspeicher genügt.
type oauthStates struct {
	mu     sync.Mutex
	ttl    time.Duration
	now    func() time.Time
	states map[string]oauthState
}

type oauthState struct {
	userID  int64
	expires time.Time
}

func newOAuthStates(ttl time.Duration) *oauthStates {
	return &oauthStates{ttl: ttl, now: time.Now, states: map[string]oauthState{}}
}

// create erzeugt einen neuen state für das Konto.
func (s *oauthStates) create(userID int64) string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	st := hex.EncodeToString(b)
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	for k, v := range s.states { // abgelaufene Einträge aufräumen
		if !v.expires.After(now) {
			delete(s.states, k)
		}
	}
	s.states[st] = oauthState{userID: userID, expires: now.Add(s.ttl)}
	return st
}

// take prüft und verbraucht einen state. Er gilt nur einmal, nur für dasselbe Konto und nur bis zum Ablauf.
func (s *oauthStates) take(state string, userID int64) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	v, ok := s.states[state]
	if !ok {
		return false
	}
	if v.userID != userID {
		return false // fremder Rückruf verbraucht den state nicht
	}
	delete(s.states, state)
	return v.expires.After(s.now())
}

func toLinkedInSettings(s service.LinkedInSettings) api.LinkedInSettings {
	out := api.LinkedInSettings{
		AppConfigured: s.AppConfigured, Connected: s.Connected, Expired: s.Expired, Enabled: s.Enabled,
		PreferredLang: api.Lang(s.PreferredLang), ConnectedAt: s.ConnectedAt, ExpiresAt: s.ExpiresAt,
	}
	if s.ProfileName != "" {
		out.ProfileName = &s.ProfileName
	}
	return out
}

func toLinkedInShare(sh *service.Share) *api.LinkedInShare {
	if sh == nil {
		return nil
	}
	out := &api.LinkedInShare{State: api.LinkedInShareState(sh.State), UpdatedAt: sh.UpdatedAt}
	if sh.Lang != "" {
		l := api.Lang(sh.Lang)
		out.Lang = &l
	}
	if sh.PostURL != "" {
		out.PostUrl = &sh.PostURL
	}
	if sh.Message != "" {
		out.Message = &sh.Message
	}
	return out
}

func (s *apiServer) AdminGetLinkedInSettings(ctx context.Context, _ api.AdminGetLinkedInSettingsRequestObject) (api.AdminGetLinkedInSettingsResponseObject, error) {
	st, err := s.social.LinkedIn(ctx)
	if err != nil {
		return nil, err
	}
	return api.AdminGetLinkedInSettings200JSONResponse(toLinkedInSettings(st)), nil
}

func (s *apiServer) AdminUpdateLinkedInSettings(ctx context.Context, req api.AdminUpdateLinkedInSettingsRequestObject) (api.AdminUpdateLinkedInSettingsResponseObject, error) {
	if req.Body == nil || !req.Body.PreferredLang.Valid() {
		return api.AdminUpdateLinkedInSettings400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgBadLang}}, nil
	}
	st, err := s.social.UpdateLinkedIn(ctx, req.Body.Enabled, service.Lang(req.Body.PreferredLang))
	var verr *service.ValidationError
	switch {
	case errors.As(err, &verr):
		return api.AdminUpdateLinkedInSettings422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{Message: verr.Msg}}, nil
	case err != nil:
		return nil, err
	}
	return api.AdminUpdateLinkedInSettings200JSONResponse(toLinkedInSettings(st)), nil
}

func (s *apiServer) AdminAuthorizeLinkedIn(ctx context.Context, _ api.AdminAuthorizeLinkedInRequestObject) (api.AdminAuthorizeLinkedInResponseObject, error) {
	id, ok := identityFrom(ctx)
	if !ok {
		return api.AdminAuthorizeLinkedIn401JSONResponse{UnauthorizedJSONResponse: api.UnauthorizedJSONResponse{Message: "Anmeldung erforderlich."}}, nil
	}
	if s.linkedin == nil || !s.linkedin.Configured() {
		return api.AdminAuthorizeLinkedIn422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{
			Message: "Die LinkedIn-App ist auf dem Server nicht eingerichtet (LINKEDIN_CLIENT_ID und LINKEDIN_CLIENT_SECRET fehlen).",
		}}, nil
	}
	return api.AdminAuthorizeLinkedIn200JSONResponse{AuthorizationUrl: s.linkedin.AuthorizationURL(s.oauth.create(id.UserID))}, nil
}

// AdminLinkedInCallback schließt die Autorisierung ab. Jeder Fehler führt ohne gespeicherte Verbindung zur
// Einstellungsseite zurück; Token und Antworten von LinkedIn erscheinen weder dort noch im Protokoll (REQ-85-AC5).
func (s *apiServer) AdminLinkedInCallback(ctx context.Context, req api.AdminLinkedInCallbackRequestObject) (api.AdminLinkedInCallbackResponseObject, error) {
	back := func(result string) (api.AdminLinkedInCallbackResponseObject, error) {
		return api.AdminLinkedInCallback303Response{Headers: api.AdminLinkedInCallback303ResponseHeaders{Location: linkedInSettingsPage + "?verbindung=" + result}}, nil
	}
	id, ok := identityFrom(ctx)
	if !ok {
		return api.AdminLinkedInCallback401JSONResponse{UnauthorizedJSONResponse: api.UnauthorizedJSONResponse{Message: "Anmeldung erforderlich."}}, nil
	}
	p := req.Params
	if p.State == nil || !s.oauth.take(*p.State, id.UserID) {
		return back("ungueltig")
	}
	if p.Error != nil || p.Code == nil || *p.Code == "" {
		return back("abgebrochen")
	}
	if s.linkedin == nil || !s.linkedin.Configured() {
		return back("fehler")
	}
	tok, err := s.linkedin.Exchange(ctx, *p.Code)
	if err != nil {
		s.log.Warn("linkedin-verbindung: tokentausch fehlgeschlagen", "fehler", err)
		return back("fehler")
	}
	prof, err := s.linkedin.Profile(ctx, tok.AccessToken)
	if err != nil {
		s.log.Warn("linkedin-verbindung: profil lesen fehlgeschlagen", "fehler", err)
		return back("fehler")
	}
	if err := s.social.ConnectLinkedIn(ctx, prof.ID, prof.Name, tok.AccessToken, tok.ExpiresAt); err != nil {
		return nil, err
	}
	s.log.Info("linkedin-profil verbunden", "konto", id.UserID)
	return back("ok")
}

func (s *apiServer) AdminDisconnectLinkedIn(ctx context.Context, _ api.AdminDisconnectLinkedInRequestObject) (api.AdminDisconnectLinkedInResponseObject, error) {
	if err := s.social.DisconnectLinkedIn(ctx); err != nil {
		return nil, err
	}
	return api.AdminDisconnectLinkedIn204Response{}, nil
}

func (s *apiServer) AdminRetryLinkedInShare(ctx context.Context, req api.AdminRetryLinkedInShareRequestObject) (api.AdminRetryLinkedInShareResponseObject, error) {
	if _, err := s.editorial.Post(ctx, req.Id); errors.Is(err, service.ErrNotFound) {
		return api.AdminRetryLinkedInShare404JSONResponse{NotFoundJSONResponse: api.NotFoundJSONResponse{Message: msgPostNotFound}}, nil
	} else if err != nil {
		return nil, err
	}
	_, err := s.social.Retry(ctx, req.Id)
	var verr *service.ValidationError
	switch {
	case errors.As(err, &verr):
		return api.AdminRetryLinkedInShare422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{Message: verr.Msg}}, nil
	case err != nil:
		return nil, err
	}
	p, err := s.editorial.Post(ctx, req.Id)
	if err != nil {
		return nil, err
	}
	return api.AdminRetryLinkedInShare200JSONResponse(toEditorPost(p)), nil
}
