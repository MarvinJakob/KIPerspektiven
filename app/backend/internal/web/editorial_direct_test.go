package web

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"ki-web/backend/internal/auth"
	"ki-web/backend/internal/service"
)

// Unit-Tests zu REQ-109-AC4 (Ticket #109): Direktaufruf der Redaktion ohne und mit Sitzung. Sollwerte aus der
// Spezifikation im Ticket: ohne gültige Sitzung führt jede geschützte Seite zur eigenständigen Anmeldeseite
// /redaktion/anmelden; mit Sitzung gelten die Berechtigungen der Rollentabelle aus #64 und die Startseiten
// Admin → /redaktion/benutzer, Redakteur → /redaktion, Marketing → /redaktion/statistik.

// sessions ordnet Cookie-Werten Rollen zu; jeder andere Wert gilt als nicht angemeldet.
type sessions map[string]service.Roles

func (s sessions) Authenticate(_ context.Context, token string) (service.Identity, error) {
	roles, ok := s[token]
	if !ok {
		return service.Identity{}, service.ErrUnauthenticated
	}
	return service.Identity{UserID: 1, Roles: roles}, nil
}

const loginMarkup = `<!doctype html><title>Redaktion</title><div id="root"></div>`

func editorialServer(t *testing.T) http.Handler {
	t.Helper()
	files := fstest.MapFS{"index.html": {Data: []byte(loginMarkup)}}
	accounts := sessions{
		"admin":     {service.RoleAdmin},
		"editor":    {service.RoleEditor},
		"marketing": {service.RoleMarketing},
	}
	mux := http.NewServeMux()
	NewEditorial(accounts, files, slog.New(slog.NewTextHandler(io.Discard, nil))).Register(mux)
	return mux
}

func get(t *testing.T, h http.Handler, path, session string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if session != "" {
		req.AddCookie(&http.Cookie{Name: auth.CookieName, Value: session})
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestREQ109AC4DirektaufrufOhneSitzung(t *testing.T) {
	h := editorialServer(t)
	protected := []string{
		"/redaktion", "/redaktion/", "/redaktion/beitraege/neu", "/redaktion/beitraege/12", "/redaktion/themenartikel",
		"/redaktion/statistik", "/redaktion/nachrichten", "/redaktion/beratungsanfragen", "/redaktion/benutzer",
		"/redaktion/einstellungen", "/redaktion/profil", "/redaktion/gibt-es-nicht",
	}
	// Fehlendes, leeres, abgelaufenes oder erfundenes Cookie: keine gültige Sitzung.
	for _, session := range []string{"", "abgelaufen-oder-erfunden"} {
		for _, path := range protected {
			rec := get(t, h, path, session)
			if rec.Code != http.StatusSeeOther || rec.Header().Get("Location") != "/redaktion/anmelden" {
				t.Errorf("%s (Cookie %q): Status %d, Location %q; erwartet 303 nach /redaktion/anmelden",
					path, session, rec.Code, rec.Header().Get("Location"))
			}
			if strings.Contains(rec.Body.String(), `id="root"`) {
				t.Errorf("%s (Cookie %q): Redaktionsanwendung darf ohne Sitzung nicht ausgeliefert werden", path, session)
			}
		}
		// Die Anmeldeseite selbst ist ohne Sitzung erreichbar und wird nicht zwischengespeichert oder indexiert.
		rec := get(t, h, "/redaktion/anmelden", session)
		if rec.Code != http.StatusOK || rec.Body.String() != loginMarkup {
			t.Errorf("/redaktion/anmelden (Cookie %q): Status %d, erwartet 200 mit der Anmeldeseite", session, rec.Code)
		}
		if got := rec.Header().Get("Cache-Control"); got != "no-store" {
			t.Errorf("/redaktion/anmelden: Cache-Control %q, erwartet no-store", got)
		}
		if got := rec.Header().Get("X-Robots-Tag"); got != "noindex" {
			t.Errorf("/redaktion/anmelden: X-Robots-Tag %q, erwartet noindex", got)
		}
	}
}

func TestREQ109AC4DirektaufrufMitSitzung(t *testing.T) {
	h := editorialServer(t)
	cases := []struct {
		session, path string
		status        int
		location      string
	}{
		// Direktaufruf von /redaktion gemäß bestehenden Berechtigungen
		{"editor", "/redaktion", http.StatusOK, ""},
		{"admin", "/redaktion", http.StatusOK, ""},
		{"marketing", "/redaktion", http.StatusForbidden, ""},
		{"marketing", "/redaktion/statistik", http.StatusOK, ""},
		{"editor", "/redaktion/statistik", http.StatusForbidden, ""},
		{"editor", "/redaktion/benutzer", http.StatusForbidden, ""},
		{"admin", "/redaktion/benutzer", http.StatusOK, ""},
		// Anmeldeseite mit gültiger Sitzung: weiter zur Startseite der Rolle (Einstieg nach der Anmeldung im Dialog, AC3)
		{"admin", "/redaktion/anmelden", http.StatusSeeOther, "/redaktion/benutzer"},
		{"editor", "/redaktion/anmelden", http.StatusSeeOther, "/redaktion"},
		{"marketing", "/redaktion/anmelden", http.StatusSeeOther, "/redaktion/statistik"},
	}
	for _, c := range cases {
		rec := get(t, h, c.path, c.session)
		if rec.Code != c.status || rec.Header().Get("Location") != c.location {
			t.Errorf("%s als %s: Status %d, Location %q; erwartet %d, %q",
				c.path, c.session, rec.Code, rec.Header().Get("Location"), c.status, c.location)
		}
	}
}
