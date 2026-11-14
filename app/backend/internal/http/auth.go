package httpserver

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"ki-web/backend/internal/api"
	"ki-web/backend/internal/auth"
	"ki-web/backend/internal/service"
)

// Begrenzung der Anmeldeversuche je IP-Adresse (ARCHITECTURE.md, Abschnitt 4). Laufende Versuche zählen bei
// der Zulassung mit (Ticket #138).
const (
	loginMaxFailures = 10
	loginWindow      = 15 * time.Minute
)

// Globale Begrenzung gleichzeitiger Passwortprüfungen über alle IP-Adressen (Ticket #138). Ausgelegt auf den
// Produktionsserver mit 1 vCPU und 2 GB RAM (docs/betrieb.md); Begründung und Messwerte stehen in
// docs/login-begrenzung.md:
//   - Eine Argon2id-Prüfung belegt 64 MiB und rechnet lokal etwa 80 ms auf einem Kern. Mehr gleichzeitige
//     Prüfungen als Kerne erhöhen den Durchsatz nicht, sondern nur Speicherbedarf und Wartezeit aller übrigen
//     Anfragen. Im Lasttest mit einem Kern hielt ein Platz Speicher und Healthcheck-Zeiten niedriger als zwei.
//     Bei mehr Kernen kann der Wert steigen.
//   - Acht Wartende fangen gleichzeitige Anmeldungen des kleinen Redaktionsteams ab, ohne sie abzuweisen.
//     Bei etwa 0,1–0,2 s je Prüfung wartet der letzte von ihnen rund 1–2 s; drei Sekunden lassen dafür
//     Spielraum und begrenzen die Haltezeit unter Last.
//   - Alle weiteren Anfragen erhalten sofort 503 mit Retry-After, ohne Argon2 zu starten.
const (
	passwordChecksActive  = 1
	passwordChecksWaiting = 8
	passwordChecksMaxWait = 3 * time.Second
	loginRetryAfter       = 5 // Sekunden
)

type ctxKey int

const (
	identityKey ctxKey = iota
	clientIPKey
)

// identityFrom liefert die vom guard geprüfte Identität der Sitzung.
func identityFrom(ctx context.Context) (service.Identity, bool) {
	id, ok := ctx.Value(identityKey).(service.Identity)
	return id, ok
}

// clientIPFrom liefert die vom guard ermittelte IP-Adresse der Anfrage.
func clientIPFrom(ctx context.Context) string {
	ip, _ := ctx.Value(clientIPKey).(string)
	return ip
}

// guard schützt die Redaktions-API. Die Entscheidung trifft ausschließlich das Backend
// (ARCHITECTURE.md, Abschnitt 1):
//   - /api/admin/*, /api/auth/me und /api/auth/logout verlangen eine gültige Sitzung (sonst 401).
//   - /api/admin/users* verlangt die Rolle admin, die übrigen /api/admin-Pfade eine Redaktionsrolle (sonst 403).
//   - Schreibende Aufrufe mit Sitzung verlangen das CSRF-Token der Sitzung im Header X-CSRF-Token (sonst 403).
//   - Schreibende API-Aufrufe von fremden Ursprüngen werden abgelehnt (403).
type guard struct {
	accounts   *service.Accounts
	trustProxy bool
	log        *slog.Logger
}

// unsafeMethod meldet, ob die Methode Daten verändern darf (und deshalb CSRF-Schutz braucht).
func unsafeMethod(m string) bool {
	return m != http.MethodGet && m != http.MethodHead && m != http.MethodOptions
}

// needsSession meldet, ob der API-Pfad eine gültige Sitzung verlangt.
func needsSession(p string) bool {
	return p == "/api/admin" || strings.HasPrefix(p, "/api/admin/") || p == "/api/auth/me" || p == "/api/auth/logout"
}

// wrap prüft Herkunft, Sitzung, CSRF-Token und Rolle vor dem eigentlichen Handler.
func (g *guard) wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		if !strings.HasPrefix(p, "/api/") {
			next.ServeHTTP(w, r)
			return
		}
		ctx := context.WithValue(r.Context(), clientIPKey, g.clientIP(r))
		if p == "/api/auth/login" {
			ctx = context.WithValue(ctx, previousSessionKey{}, sessionToken(r))
		}
		if unsafeMethod(r.Method) && !sameOrigin(r) {
			writeJSONError(w, http.StatusForbidden, "Anfrage von fremder Herkunft abgelehnt.")
			return
		}
		if !needsSession(p) {
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}
		id, err := g.accounts.Authenticate(ctx, sessionToken(r))
		if errors.Is(err, service.ErrUnauthenticated) {
			writeJSONError(w, http.StatusUnauthorized, "Anmeldung erforderlich.")
			return
		}
		if err != nil {
			g.log.Error("sitzung prüfen", "fehler", err)
			writeJSONError(w, http.StatusInternalServerError, "Interner Fehler.")
			return
		}
		if unsafeMethod(r.Method) && !auth.EqualTokens(r.Header.Get("X-CSRF-Token"), id.CSRFToken) {
			writeJSONError(w, http.StatusForbidden, "CSRF-Token fehlt oder ist ungültig. Bitte die Seite neu laden.")
			return
		}
		if !allowed(p, id.Role) {
			writeJSONError(w, http.StatusForbidden, "Keine Berechtigung für diesen Bereich.")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, identityKey, id)))
	})
}

// allowed prüft die Rolle für einen geschützten API-Pfad.
func allowed(p string, role service.Role) bool {
	switch {
	case p == "/api/admin/users" || strings.HasPrefix(p, "/api/admin/users/"):
		return role.CanManageUsers()
	case p == "/api/admin" || strings.HasPrefix(p, "/api/admin/"):
		return role.CanEdit()
	}
	return true // /api/auth/me und /api/auth/logout: jede gültige Sitzung
}

// sessionToken liest das Sitzungs-Token aus dem Cookie, leer wenn es fehlt.
func sessionToken(r *http.Request) string {
	c, err := r.Cookie(auth.CookieName)
	if err != nil {
		return ""
	}
	return c.Value
}

// sameOrigin lehnt schreibende Anfragen ab, die ein Browser von einer fremden Seite schickt.
// Anfragen ohne Origin (z. B. von Werkzeugen) sind erlaubt; sie tragen kein Sitzungscookie des Browsers.
func sameOrigin(r *http.Request) bool {
	if o := r.Header.Get("Origin"); o != "" {
		u, err := url.Parse(o)
		return err == nil && strings.EqualFold(u.Host, r.Host)
	}
	return r.Header.Get("Sec-Fetch-Site") != "cross-site"
}

// clientIP ermittelt die IP-Adresse für die Begrenzung der Anmeldeversuche. Hinter Caddy steht sie im
// letzten Eintrag von X-Forwarded-For, den Caddy selbst setzt.
func (g *guard) clientIP(r *http.Request) string {
	if g.trustProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			return strings.TrimSpace(parts[len(parts)-1])
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// ---------------------------------------------------------------------------
// Handler für /api/auth
// ---------------------------------------------------------------------------

// sessionCookie baut den Set-Cookie-Header: HttpOnly, SameSite=Lax und bei HTTPS Secure.
func (s *apiServer) sessionCookie(value string, maxAge int, expires time.Time) string {
	c := &http.Cookie{
		Name:     auth.CookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		Expires:  expires,
		HttpOnly: true,
		Secure:   s.secureCookies,
		SameSite: http.SameSiteLaxMode,
	}
	return c.String()
}

// toMe wandelt die Identität in die API-Antwort um.
func toMe(id service.Identity) api.Me {
	return api.Me{Id: id.UserID, Email: id.Email, Role: api.Role(id.Role), CsrfToken: id.CSRFToken}
}

// Login meldet an und ersetzt eine bestehende Sitzung des Browsers. Vor der teuren Argon2-Prüfung gelten zwei
// Grenzen (Ticket #138):
//  1. Je IP-Adresse höchstens loginMaxFailures Fehlversuche je loginWindow. Laufende Versuche zählen mit,
//     sonst 429.
//  2. Über alle IP-Adressen höchstens passwordChecksActive gleichzeitige Prüfungen und passwordChecksWaiting
//     Wartende, sonst 503 mit Retry-After.
//
// Das Ergebnis bestimmt, was die Reservierung der IP-Adresse hinterlässt:
//   - Falsche Zugangsdaten (unbekanntes Konto, falsches Passwort, deaktiviertes Konto) zählen als Fehlversuch.
//   - Eine erfolgreiche Anmeldung setzt die Fehlversuche der IP-Adresse zurück.
//   - Ohne Ergebnis der Passwortprüfung (ungültige Anfrage, 503, Abbruch durch den Client, interner Fehler)
//     wird die Reservierung nur freigegeben. Bereits gezählte Fehlversuche bleiben bestehen. Bricht der Client
//     während der Prüfung ab, läuft sie zu Ende und ihr Ergebnis zählt.
func (s *apiServer) Login(ctx context.Context, req api.LoginRequestObject) (api.LoginResponseObject, error) {
	attempt, ok := s.limiter.Reserve(clientIPFrom(ctx))
	if !ok {
		return api.Login429JSONResponse{Message: "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen."}, nil
	}
	// Wirkt nur, wenn unten kein Ergebnis gemeldet wurde, und gibt die Reservierung auch nach einem Panic frei.
	defer attempt.Cancel()
	if req.Body == nil || strings.TrimSpace(req.Body.Email) == "" || req.Body.Password == "" {
		return api.Login400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{
			Message: "Bitte E-Mail-Adresse und Passwort angeben.",
		}}, nil
	}
	sess, err := s.checkCredentials(ctx, req.Body.Email, req.Body.Password)
	switch {
	case errors.Is(err, service.ErrInvalidCredentials):
		attempt.Count() // Fehlversuch
		return api.Login401JSONResponse{UnauthorizedJSONResponse: api.UnauthorizedJSONResponse{
			Message: "E-Mail-Adresse oder Passwort ist falsch, oder das Konto ist deaktiviert.",
		}}, nil
	case errors.Is(err, auth.ErrBusy), err != nil && ctx.Err() != nil:
		// Überlast, oder der Client hat abgebrochen und erhält die Antwort ohnehin nicht mehr. Kein Fehlerprotokoll,
		// damit abgebrochene Anfragen unter Last das Protokoll nicht füllen.
		return api.Login503JSONResponse{
			Body:    api.Error{Message: "Die Anmeldung ist gerade ausgelastet. Bitte in einigen Sekunden erneut versuchen."},
			Headers: api.Login503ResponseHeaders{RetryAfter: loginRetryAfter},
		}, nil
	case err != nil:
		return nil, err
	}
	attempt.Reset() // Erfolg setzt die Fehlversuche der IP-Adresse zurück
	// Eine vorherige Sitzung desselben Browsers wird ersetzt.
	if old, ok := ctx.Value(previousSessionKey{}).(string); ok && old != "" {
		_ = s.accounts.Logout(ctx, auth.HashToken(old))
	}
	cookie := s.sessionCookie(sess.Token, int(service.SessionTTL.Seconds()), sess.ExpiresAt)
	return api.Login200JSONResponse{Body: toMe(sess.Identity), Headers: api.Login200ResponseHeaders{SetCookie: &cookie}}, nil
}

// checkCredentials prüft die Zugangsdaten auf einem der global begrenzten Plätze für Passwortprüfungen.
// Liefert auth.ErrBusy, ohne Argon2 zu starten, wenn kein Platz frei wird.
func (s *apiServer) checkCredentials(ctx context.Context, email, password string) (service.Session, error) {
	if err := s.passwordChecks.Acquire(ctx); err != nil {
		return service.Session{}, err
	}
	defer s.passwordChecks.Release()
	return s.login(ctx, email, password)
}

// previousSessionKey trägt das Cookie einer bestehenden Sitzung zum Login-Handler.
type previousSessionKey struct{}

// Logout löscht die Sitzung serverseitig und das Cookie im Browser.
func (s *apiServer) Logout(ctx context.Context, _ api.LogoutRequestObject) (api.LogoutResponseObject, error) {
	id, ok := identityFrom(ctx)
	if !ok {
		return api.Logout401JSONResponse{UnauthorizedJSONResponse: api.UnauthorizedJSONResponse{Message: "Anmeldung erforderlich."}}, nil
	}
	if err := s.accounts.Logout(ctx, id.SessionID); err != nil {
		return nil, err
	}
	cookie := s.sessionCookie("", -1, time.Unix(0, 0))
	return api.Logout204Response{Headers: api.Logout204ResponseHeaders{SetCookie: &cookie}}, nil
}

// GetMe liefert das angemeldete Konto samt CSRF-Token.
func (s *apiServer) GetMe(ctx context.Context, _ api.GetMeRequestObject) (api.GetMeResponseObject, error) {
	id, ok := identityFrom(ctx)
	if !ok {
		return api.GetMe401JSONResponse{UnauthorizedJSONResponse: api.UnauthorizedJSONResponse{Message: "Anmeldung erforderlich."}}, nil
	}
	return api.GetMe200JSONResponse(toMe(id)), nil
}
