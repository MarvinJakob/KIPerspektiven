package httpserver_test

import (
	"fmt"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

	"ki-web/backend/internal/api"
	httpserver "ki-web/backend/internal/http"
)

// Ticket #136: Kostenloses Beratungsgespräch nach der Selbsteinschätzung per Kontaktformular anfragen.

const consultPath = "/api/consultation-requests"

func consultation(email string, lang api.Lang) api.ConsultationRequestInput {
	return api.ConsultationRequestInput{Email: email, Lang: lang}
}

// listConsultations liest die offenen Anfragen so, wie die Redaktion sie sieht.
func listConsultations(t *testing.T, b *browser) []api.ConsultationRequest {
	t.Helper()
	resp, body := b.do(http.MethodGet, "/api/admin/consultation-requests", nil)
	wantStatus(t, resp, body, http.StatusOK)
	return decode[api.ConsultationRequestList](t, body).Items
}

// Gespeichert wird nur, was die Terminabstimmung braucht.
func TestConsultationSchemaHoldsOnlyContactData(t *testing.T) {
	_, db := newServer(t, false)
	if got, want := columns(t, db, "consultation_requests"), []string{"id", "email", "lang", "requested_at"}; !slices.Equal(got, want) {
		t.Fatalf("Spalten %v, erwartet %v", got, want)
	}
}

// Eine gültige Anfrage ist danach für die Redaktion sichtbar: Eingang nachweisbar.
func TestConsultationRequestReachesEditorialTeam(t *testing.T) {
	srv, db := newServerWithAccounts(t)
	visitor := newBrowser(t, srv)
	before := time.Now().Add(-time.Second)

	resp, body := visitor.do(http.MethodPost, consultPath, consultation("  Kundin@Beispiel.DE ", api.De))
	wantStatus(t, resp, body, http.StatusNoContent)
	if c := resp.Header.Values("Set-Cookie"); len(c) > 0 {
		t.Errorf("Anfrage setzt Cookies: %v", c)
	}
	resp, body = visitor.do(http.MethodPost, consultPath, consultation("person@example.org", api.En))
	wantStatus(t, resp, body, http.StatusNoContent)

	editor := newBrowser(t, srv)
	editor.mustLogin(editorEmail)
	items := listConsultations(t, editor)
	if len(items) != 2 {
		t.Fatalf("%d Anfragen, erwartet 2: %+v", len(items), items)
	}
	newest, older := items[0], items[1]
	if newest.Email != "person@example.org" || newest.Lang != api.En {
		t.Errorf("neueste Anfrage: %+v", newest)
	}
	// Leerzeichen und Großschreibung werden normalisiert, damit dieselbe Adresse nicht doppelt erscheint.
	if older.Email != "kundin@beispiel.de" || older.Lang != api.De || older.RequestedAt.Before(before) {
		t.Errorf("ältere Anfrage: %+v", older)
	}
	if n := count(t, db, "consultation_requests"); n != 2 {
		t.Fatalf("%d Einträge in der Datenbank", n)
	}

	// Admin-Konten sehen dieselben Anfragen.
	admin := newBrowser(t, srv)
	admin.mustLogin(adminEmail)
	if got := listConsultations(t, admin); len(got) != 2 {
		t.Fatalf("Admin sieht %d Anfragen", len(got))
	}
}

// Wer nach einem Netzfehler erneut sendet oder später noch einmal anfragt, erzeugt keinen zweiten Eintrag.
func TestConsultationRequestIsNotDuplicated(t *testing.T) {
	srv, db := newServerWithAccounts(t)
	visitor := newBrowser(t, srv)
	resp, body := visitor.do(http.MethodPost, consultPath, consultation("kundin@beispiel.de", api.De))
	wantStatus(t, resp, body, http.StatusNoContent)
	const old = "2026-01-01T00:00:00Z"
	if _, err := db.Exec("UPDATE consultation_requests SET requested_at = ?", old); err != nil {
		t.Fatal(err)
	}
	resp, body = visitor.do(http.MethodPost, consultPath, consultation("KUNDIN@beispiel.de", api.En))
	wantStatus(t, resp, body, http.StatusNoContent)

	var lang, at string
	if err := db.QueryRow("SELECT lang, requested_at FROM consultation_requests").Scan(&lang, &at); err != nil {
		t.Fatal(err)
	}
	if n := count(t, db, "consultation_requests"); n != 1 || lang != "en" || at == old {
		t.Fatalf("%d Einträge, Sprache %s, Zeitpunkt %s; erwartet ein aktualisierter Eintrag", n, lang, at)
	}
}

// Leere oder formal ungültige Adressen werden nicht angenommen.
func TestConsultationRequestRejectsInvalidInput(t *testing.T) {
	srv, db := newServer(t, false)
	b := newBrowser(t, srv)
	for name, in := range map[string]api.ConsultationRequestInput{
		"leer":                 consultation("", api.De),
		"nur Leerzeichen":      consultation("   ", api.De),
		"ohne @":               consultation("kundin.beispiel.de", api.De),
		"ohne Domain":          consultation("kundin@", api.De),
		"Domain ohne Punkt":    consultation("kundin@localhost", api.De),
		"mit Namen":            consultation("Kundin <kundin@beispiel.de>", api.De),
		"zwei Adressen":        consultation("a@beispiel.de, b@beispiel.de", api.De),
		"Leerzeichen innen":    consultation("kun din@beispiel.de", api.De),
		"zu lang":              consultation(strings.Repeat("a", 243)+"@beispiel.de", api.De), // 255 Zeichen
		"unbekannte Sprache":   consultation("kundin@beispiel.de", "fr"),
		"Sprache fehlt":        {Email: "kundin@beispiel.de"},
		"doppelter Punkt":      consultation("kun..din@beispiel.de", api.De),
		"Zeilenumbruch":        consultation("kundin@beispiel.de\nBcc: x@y.de", api.De),
		"Punkt am Ende lokal":  consultation("kundin.@beispiel.de", api.De),
		"Domain mit Leerzeich": consultation("kundin@beis piel.de", api.De),
	} {
		resp, body := b.do(http.MethodPost, consultPath, in)
		if resp.StatusCode != http.StatusUnprocessableEntity {
			t.Errorf("%s: Status %d, erwartet 422 (%s)", name, resp.StatusCode, body)
		}
	}
	for name, raw := range map[string]string{"kein JSON": "{", "kein Text": ""} {
		req, _ := http.NewRequest(http.MethodPost, srv.URL+consultPath, strings.NewReader(raw))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("%s: Status %d, erwartet 400", name, resp.StatusCode)
		}
	}
	if n := count(t, db, "consultation_requests"); n != 0 {
		t.Fatalf("%d ungültige Anfragen gespeichert", n)
	}
}

// Wie alle öffentlichen Schreibzugriffe: Herkunft prüfen, Größe begrenzen.
func TestConsultationRequestChecksOriginAndSize(t *testing.T) {
	srv, db := newServer(t, false)
	b := newBrowser(t, srv)
	resp, body := b.do(http.MethodPost, consultPath, consultation("kundin@beispiel.de", api.De), "Origin", "https://fremd.example")
	wantStatus(t, resp, body, http.StatusForbidden)
	resp, body = b.do(http.MethodPost, consultPath, consultation("kundin@beispiel.de", api.De), "Sec-Fetch-Site", "cross-site")
	wantStatus(t, resp, body, http.StatusForbidden)
	resp, body = b.do(http.MethodPost, consultPath, consultation(strings.Repeat("x", 8<<10)+"@beispiel.de", api.De))
	wantStatus(t, resp, body, http.StatusRequestEntityTooLarge)
	if n := count(t, db, "consultation_requests"); n != 0 {
		t.Fatalf("%d Anfragen gespeichert", n)
	}
}

// Mehr als fünf angenommene Anfragen je IP-Adresse und Stunde lehnt das Backend ab. Ungültige Eingaben zählen
// nicht mit, und andere IP-Adressen sind nicht betroffen.
func TestConsultationRequestsAreLimitedPerIP(t *testing.T) {
	srv, db := newServer(t, false, func(c *httpserver.Config) { c.TrustProxy = true })
	b := newBrowser(t, srv)
	send := func(email, ip string) int {
		t.Helper()
		resp, _ := b.do(http.MethodPost, consultPath, consultation(email, api.De), "X-Forwarded-For", ip)
		return resp.StatusCode
	}
	for i := range 3 {
		if got := send("ungueltig", "203.0.113.7"); got != http.StatusUnprocessableEntity {
			t.Fatalf("ungültige Anfrage %d: Status %d", i, got)
		}
	}
	for i := 1; i <= 5; i++ {
		if got := send(fmt.Sprintf("person%d@beispiel.de", i), "203.0.113.7"); got != http.StatusNoContent {
			t.Fatalf("Anfrage %d: Status %d, erwartet 204", i, got)
		}
	}
	resp, body := b.do(http.MethodPost, consultPath, consultation("person6@beispiel.de", api.De), "X-Forwarded-For", "203.0.113.7")
	wantStatus(t, resp, body, http.StatusTooManyRequests)
	if !strings.Contains(body, "Zu viele Anfragen") {
		t.Errorf("Meldung: %s", body)
	}
	if got := send("andere@beispiel.de", "198.51.100.2"); got != http.StatusNoContent {
		t.Fatalf("andere IP-Adresse: Status %d, erwartet 204", got)
	}
	if n := count(t, db, "consultation_requests"); n != 6 {
		t.Fatalf("%d Anfragen gespeichert, erwartet 6", n)
	}
}

// Anfragen enthalten personenbezogene Daten: Nur Redaktionskonten sehen und löschen sie.
func TestConsultationRequestsRequireEditorialSession(t *testing.T) {
	srv, _ := newServerWithAccounts(t)
	visitor := newBrowser(t, srv)
	resp, body := visitor.do(http.MethodPost, consultPath, consultation("kundin@beispiel.de", api.De))
	wantStatus(t, resp, body, http.StatusNoContent)

	resp, body = visitor.do(http.MethodGet, "/api/admin/consultation-requests", nil)
	wantStatus(t, resp, body, http.StatusUnauthorized)
	if strings.Contains(body, "kundin") {
		t.Fatalf("Anfragen ohne Anmeldung sichtbar: %s", body)
	}
	resp, body = visitor.do(http.MethodDelete, "/api/admin/consultation-requests/1", nil)
	wantStatus(t, resp, body, http.StatusUnauthorized)
	resp, _ = visitor.do(http.MethodGet, "/redaktion/beratungsanfragen", nil)
	wantRedirect(t, resp, "/redaktion/anmelden")

	for _, email := range []string{editorEmail, adminEmail} {
		b := newBrowser(t, srv)
		b.mustLogin(email)
		resp, body := b.do(http.MethodGet, "/redaktion/beratungsanfragen", nil)
		wantStatus(t, resp, body, http.StatusOK)
	}
}

// Nach der Terminabstimmung löscht die Redaktion die Anfrage; Löschen braucht das CSRF-Token.
func TestConsultationRequestCanBeDeleted(t *testing.T) {
	srv, db := newServerWithAccounts(t)
	visitor := newBrowser(t, srv)
	for _, e := range []string{"eins@beispiel.de", "zwei@beispiel.de"} {
		resp, body := visitor.do(http.MethodPost, consultPath, consultation(e, api.De))
		wantStatus(t, resp, body, http.StatusNoContent)
	}
	editor := newBrowser(t, srv)
	editor.mustLogin(editorEmail)
	items := listConsultations(t, editor)
	target := items[len(items)-1]
	path := fmt.Sprintf("/api/admin/consultation-requests/%d", target.Id)

	csrf := editor.csrf
	editor.csrf = ""
	resp, body := editor.do(http.MethodDelete, path, nil)
	wantStatus(t, resp, body, http.StatusForbidden)
	editor.csrf = csrf

	resp, body = editor.do(http.MethodDelete, path, nil)
	wantStatus(t, resp, body, http.StatusNoContent)
	rest := listConsultations(t, editor)
	if len(rest) != 1 || rest[0].Email == target.Email || count(t, db, "consultation_requests") != 1 {
		t.Fatalf("nach dem Löschen: %+v", rest)
	}
	resp, body = editor.do(http.MethodDelete, path, nil)
	wantStatus(t, resp, body, http.StatusNotFound)
}
