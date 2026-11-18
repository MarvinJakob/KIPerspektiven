package service

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"ki-web/backend/internal/linkedin"
	"ki-web/backend/internal/store"
)

// PlatformLinkedIn ist die einzige Plattform dieser Ausbaustufe (Ticket #85).
const PlatformLinkedIn = "linkedin"

// LinkedInAPI ist der Teil des LinkedIn-Clients, den das Teilen braucht. Tests setzen ein Testdouble ein.
type LinkedInAPI interface {
	Configured() bool
	CreatePost(ctx context.Context, token string, p linkedin.Post) (string, error)
}

// ShareState ist der LinkedIn-Status eines Beitrags (REQ-85-AC8, AC12, AC13).
type ShareState string

const (
	SharePending   ShareState = "pending"   // wartet auf den Versand
	ShareSending   ShareState = "sending"   // wird gerade gesendet
	ShareSucceeded ShareState = "succeeded" // geteilt
	ShareFailed    ShareState = "failed"    // eindeutig abgelehnt, wiederholbar
	ShareUnknown   ShareState = "unknown"   // Ausgang unklar, nicht wiederholbar
)

// Share ist der LinkedIn-Status eines Beitrags.
type Share struct {
	State     ShareState
	Lang      Lang   // geteilte Sprachfassung, leer solange nicht gesendet
	PostURL   string // Link zum LinkedIn-Post bei Erfolg
	Message   string // verständlicher Hinweis bei Fehler oder unklarem Ausgang
	UpdatedAt time.Time
}

// LinkedInSettings sind die Einstellungen unter „Einstellungen → Social Media → LinkedIn“. Sie enthalten
// bewusst kein Zugriffstoken (REQ-85-AC5).
type LinkedInSettings struct {
	AppConfigured bool
	Connected     bool
	Expired       bool
	Enabled       bool
	ProfileName   string
	ConnectedAt   *time.Time
	ExpiresAt     *time.Time
	PreferredLang Lang
}

// Hinweise am Beitrag. Sie nennen Ursache und Abhilfe, nie Token oder Antworttexte von LinkedIn (REQ-85-AC5).
const (
	msgSettingsPath  = "Einstellungen → Social Media → LinkedIn"
	msgExpired       = "Die LinkedIn-Autorisierung ist abgelaufen. Ein Admin muss die Verbindung unter " + msgSettingsPath + " erneuern; danach „Erneut an LinkedIn senden“."
	msgRejected401   = "LinkedIn hat den Post abgelehnt: Die Autorisierung ist abgelaufen oder wurde widerrufen. Ein Admin muss die Verbindung unter " + msgSettingsPath + " erneuern; danach „Erneut an LinkedIn senden“."
	msgRejected403   = "LinkedIn hat den Post abgelehnt: Der Verbindung fehlt die Berechtigung zum Teilen. Ein Admin muss die Verbindung unter " + msgSettingsPath + " erneuern."
	msgRejected429   = "LinkedIn hat den Post abgelehnt, weil gerade zu viele Anfragen gestellt wurden. Bitte später „Erneut an LinkedIn senden“."
	msgRejected      = "LinkedIn hat den Post abgelehnt. Bitte Titel und Link prüfen und „Erneut an LinkedIn senden“."
	msgUnknown       = "Ob LinkedIn den Post angelegt hat, ist unklar (keine eindeutige Antwort). Bitte das LinkedIn-Profil prüfen und den Beitrag bei Bedarf dort selbst teilen. Eine Wiederholung ist gesperrt, damit kein doppelter Post entsteht."
	msgInterrupted   = "Der Versand wurde durch einen Neustart unterbrochen. Ob LinkedIn den Post angelegt hat, ist unklar. Bitte das LinkedIn-Profil prüfen und den Beitrag bei Bedarf dort selbst teilen."
	msgDisconnected  = "Die LinkedIn-Verbindung wurde vor dem Senden getrennt oder ausgeschaltet. Nach dem Einrichten unter " + msgSettingsPath + " „Erneut an LinkedIn senden“."
	msgNotPublished  = "Der Beitrag war beim Senden nicht veröffentlicht. Nach dem Veröffentlichen „Erneut an LinkedIn senden“."
	msgAppMissing    = "Die LinkedIn-App ist auf dem Server nicht eingerichtet (LINKEDIN_CLIENT_ID und LINKEDIN_CLIENT_SECRET fehlen)."
	msgNotConnected  = "Es ist noch kein LinkedIn-Profil verbunden. Bitte zuerst „Mit LinkedIn verbinden“."
	msgExpiredEnable = "Die LinkedIn-Autorisierung ist abgelaufen. Bitte neu verbinden."
	msgRetryUnknown  = "Bei unklarem Ausgang ist keine Wiederholung möglich, damit kein doppelter Post entsteht. Bitte das LinkedIn-Profil prüfen."
	msgRetryDone     = "Der Beitrag ist bereits auf LinkedIn geteilt."
	msgRetryBusy     = "Der Versand an LinkedIn läuft bereits."
	msgRetryNoShare  = "Dieser Beitrag wird nicht auf LinkedIn geteilt."
)

// Social teilt neu veröffentlichte Beiträge auf LinkedIn (Ticket #85).
//
// Ablauf: Bei der Erstveröffentlichung legt OnFirstPublication in derselben Transaktion einen Eintrag „zu teilen“
// an, sofern die Verbindung aktiv ist. SendPending sendet die Einträge im Hintergrund nach dem Commit, also erst
// wenn die öffentliche Seite erreichbar ist. Jeder Eintrag wird höchstens einmal automatisch gesendet.
type Social struct {
	db      *sql.DB
	q       *store.Queries
	api     LinkedInAPI
	baseURL string
	now     func() time.Time
	wake    chan struct{}
}

// NewSocial erzeugt den Dienst. baseURL ist die öffentliche Adresse der Webseite (PUBLIC_BASE_URL).
func NewSocial(db *sql.DB, api LinkedInAPI, baseURL string) *Social {
	return &Social{db: db, q: store.New(db), api: api, baseURL: strings.TrimRight(baseURL, "/"), now: time.Now, wake: make(chan struct{}, 1)}
}

// Wake meldet, dass Einträge zum Senden bereitstehen.
func (s *Social) Wake() <-chan struct{} { return s.wake }

// Notify weckt den Hintergrundlauf, ohne zu blockieren.
func (s *Social) Notify() {
	select {
	case s.wake <- struct{}{}:
	default:
	}
}

// ---------------------------------------------------------------------------
// Einstellungen (REQ-85-AC1, AC2)
// ---------------------------------------------------------------------------

func (s *Social) connection(ctx context.Context, q *store.Queries) (store.SocialConnection, error) {
	c, err := q.GetSocialConnection(ctx, PlatformLinkedIn)
	if errors.Is(err, sql.ErrNoRows) {
		return store.SocialConnection{Platform: PlatformLinkedIn, PreferredLang: string(DE)}, nil
	}
	return c, err
}

func connected(c store.SocialConnection) bool { return c.MemberID != "" && c.AccessToken != "" }

func (s *Social) expired(c store.SocialConnection) bool {
	return connected(c) && (!c.TokenExpiresAt.Valid || !parseTime(c.TokenExpiresAt.String).After(s.now()))
}

// LinkedIn liefert die Einstellungen ohne Zugriffstoken.
func (s *Social) LinkedIn(ctx context.Context) (LinkedInSettings, error) {
	c, err := s.connection(ctx, s.q)
	if err != nil {
		return LinkedInSettings{}, err
	}
	lang, ok := ParseLang(c.PreferredLang)
	if !ok {
		lang = DE
	}
	out := LinkedInSettings{
		AppConfigured: s.api.Configured(), Connected: connected(c), Expired: s.expired(c),
		Enabled: c.Enabled, PreferredLang: lang,
	}
	if out.Connected {
		out.ProfileName = c.MemberName
		out.ConnectedAt = optTime(c.ConnectedAt)
		out.ExpiresAt = optTime(c.TokenExpiresAt)
	}
	return out, nil
}

// UpdateLinkedIn schaltet das automatische Teilen und setzt die bevorzugte Sprache. Einschalten verlangt eine
// konfigurierte App und ein verbundenes Profil mit gültiger Autorisierung (REQ-85-AC2).
func (s *Social) UpdateLinkedIn(ctx context.Context, enabled bool, lang Lang) (LinkedInSettings, error) {
	if _, ok := ParseLang(string(lang)); !ok {
		return LinkedInSettings{}, invalid("Unbekannte Sprache %q. Erlaubt sind de und en.", lang)
	}
	if enabled {
		c, err := s.connection(ctx, s.q)
		if err != nil {
			return LinkedInSettings{}, err
		}
		if reason := s.enableBlocker(c); reason != "" {
			return LinkedInSettings{}, invalid("%s", reason)
		}
	}
	if err := s.q.SaveSocialSettings(ctx, store.SaveSocialSettingsParams{
		Platform: PlatformLinkedIn, Enabled: enabled, PreferredLang: string(lang), UpdatedAt: formatTime(s.now()),
	}); err != nil {
		return LinkedInSettings{}, err
	}
	return s.LinkedIn(ctx)
}

func (s *Social) enableBlocker(c store.SocialConnection) string {
	switch {
	case !s.api.Configured():
		return msgAppMissing
	case !connected(c):
		return msgNotConnected
	case s.expired(c):
		return msgExpiredEnable
	}
	return ""
}

// ConnectLinkedIn speichert das per OAuth verbundene Profil. Der Aktivierungszustand bleibt unverändert.
func (s *Social) ConnectLinkedIn(ctx context.Context, memberID, name, token string, expiresAt time.Time) error {
	if memberID == "" || token == "" {
		return invalid("Die LinkedIn-Verbindung ist unvollständig.")
	}
	now := formatTime(s.now())
	return s.q.SaveSocialConnection(ctx, store.SaveSocialConnectionParams{
		Platform: PlatformLinkedIn, MemberID: memberID, MemberName: name, AccessToken: token,
		TokenExpiresAt: sql.NullString{String: formatTime(expiresAt), Valid: true},
		ConnectedAt:    sql.NullString{String: now, Valid: true}, UpdatedAt: now,
	})
}

// DisconnectLinkedIn entfernt Profil und Token und schaltet das Teilen aus.
func (s *Social) DisconnectLinkedIn(ctx context.Context) error {
	return s.q.ClearSocialConnection(ctx, store.ClearSocialConnectionParams{UpdatedAt: formatTime(s.now()), Platform: PlatformLinkedIn})
}

// ---------------------------------------------------------------------------
// Teilen (REQ-85-AC6 bis AC13)
// ---------------------------------------------------------------------------

// OnFirstPublication läuft in der Transaktion der Erstveröffentlichung (Editorial). Bei aktiver Verbindung legt
// es den Eintrag „zu teilen“ an; scheitert die Veröffentlichung, entsteht mit dem Rollback auch kein Eintrag.
func (s *Social) OnFirstPublication(ctx context.Context, q *store.Queries, postID int64) error {
	c, err := s.connection(ctx, q)
	if err != nil {
		return err
	}
	if !c.Enabled || !connected(c) || !s.api.Configured() {
		return nil
	}
	now := formatTime(s.now())
	_, err = q.CreateSocialShare(ctx, store.CreateSocialShareParams{PostID: postID, Platform: PlatformLinkedIn, CreatedAt: now, UpdatedAt: now})
	return err
}

// Share liefert den LinkedIn-Status eines Beitrags, nil wenn er nicht geteilt wird.
func (s *Social) Share(ctx context.Context, postID int64) (*Share, error) {
	return loadShare(ctx, s.q, postID)
}

func loadShare(ctx context.Context, q *store.Queries, postID int64) (*Share, error) {
	row, err := q.GetSocialShare(ctx, store.GetSocialShareParams{PostID: postID, Platform: PlatformLinkedIn})
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	sh := &Share{State: ShareState(row.Status), Lang: Lang(row.Lang), Message: row.Message, UpdatedAt: parseTime(row.UpdatedAt)}
	if sh.State == ShareSucceeded && row.PostUrn != "" {
		sh.PostURL = linkedin.PostURL(row.PostUrn)
	}
	return sh, nil
}

// Retry sendet einen eindeutig abgelehnten Versand erneut (REQ-85-AC12). Bei unklarem Ausgang ist das gesperrt,
// damit kein zweiter Post entsteht (REQ-85-AC13).
func (s *Social) Retry(ctx context.Context, postID int64) (*Share, error) {
	n, err := s.q.RetrySocialShare(ctx, store.RetrySocialShareParams{UpdatedAt: formatTime(s.now()), PostID: postID, Platform: PlatformLinkedIn})
	if err != nil {
		return nil, err
	}
	if n == 0 {
		cur, err := s.Share(ctx, postID)
		if err != nil {
			return nil, err
		}
		switch {
		case cur == nil:
			return nil, invalid("%s", msgRetryNoShare)
		case cur.State == ShareUnknown:
			return nil, invalid("%s", msgRetryUnknown)
		case cur.State == ShareSucceeded:
			return nil, invalid("%s", msgRetryDone)
		default:
			return nil, invalid("%s", msgRetryBusy)
		}
	}
	s.Notify()
	return s.Share(ctx, postID)
}

// RecoverInterrupted kennzeichnet Versände, die bei einem Neustart liefen, als unklar (REQ-85-AC13).
func (s *Social) RecoverInterrupted(ctx context.Context) (int64, error) {
	return s.q.InterruptSocialShares(ctx, store.InterruptSocialSharesParams{Message: msgInterrupted, UpdatedAt: formatTime(s.now())})
}

// SendPending sendet alle wartenden Einträge nacheinander und liefert ihre Anzahl.
func (s *Social) SendPending(ctx context.Context) (int, error) {
	sent := 0
	for {
		row, err := s.q.NextPendingSocialShare(ctx)
		if errors.Is(err, sql.ErrNoRows) {
			return sent, nil
		}
		if err != nil {
			return sent, err
		}
		n, err := s.q.ClaimSocialShare(ctx, store.ClaimSocialShareParams{UpdatedAt: formatTime(s.now()), PostID: row.PostID, Platform: row.Platform})
		if err != nil {
			return sent, err
		}
		if n == 0 {
			continue
		}
		if err := s.send(ctx, row.PostID); err != nil {
			return sent, err
		}
		sent++
	}
}

// send sendet einen beanspruchten Eintrag und speichert das Ergebnis.
func (s *Social) send(ctx context.Context, postID int64) error {
	finish := func(state ShareState, lang Lang, urn, msg string) error {
		return s.q.FinishSocialShare(ctx, store.FinishSocialShareParams{
			Status: string(state), Lang: string(lang), PostUrn: urn, Message: msg, UpdatedAt: formatTime(s.now()),
			PostID: postID, Platform: PlatformLinkedIn,
		})
	}
	c, err := s.connection(ctx, s.q)
	if err != nil {
		return err
	}
	switch {
	case !c.Enabled || !connected(c) || !s.api.Configured():
		return finish(ShareFailed, "", "", msgDisconnected)
	case s.expired(c):
		return finish(ShareFailed, "", "", msgExpired)
	}
	post, err := s.q.GetPostByID(ctx, postID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil // inzwischen gelöscht; der Eintrag ist mit dem Beitrag entfernt
	}
	if err != nil {
		return err
	}
	if Status(post.Status) != StatusPublished {
		return finish(ShareFailed, "", "", msgNotPublished)
	}
	trs, err := s.q.ListPostTranslations(ctx, postID)
	if err != nil {
		return err
	}
	titles := map[Lang]string{}
	for _, tr := range trs {
		titles[Lang(tr.Lang)] = tr.Title
	}
	pref, _ := ParseLang(c.PreferredLang)
	title, lang, _ := pick(titles, pref) // bevorzugte Sprache, sonst die vorhandene (REQ-85-AC7)
	if title == "" {
		return finish(ShareFailed, "", "", msgNotPublished)
	}
	link := s.baseURL + "/" + string(lang) + "/blog/" + post.Slug
	urn, err := s.api.CreatePost(ctx, c.AccessToken, linkedin.Post{AuthorID: c.MemberID, Title: title, URL: link})
	if err == nil {
		return finish(ShareSucceeded, lang, urn, "")
	}
	var rej *linkedin.RejectedError
	if errors.As(err, &rej) && !errors.Is(err, linkedin.ErrUnknownOutcome) {
		return finish(ShareFailed, lang, "", rejectedMessage(rej.Status))
	}
	return finish(ShareUnknown, lang, "", msgUnknown)
}

func rejectedMessage(status int) string {
	switch status {
	case 401:
		return msgRejected401
	case 403:
		return msgRejected403
	case 429:
		return msgRejected429
	}
	return msgRejected
}
