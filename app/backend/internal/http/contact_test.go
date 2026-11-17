package httpserver_test

import (
	"fmt"
	"net/http"
	"net/netip"
	"strings"
	"testing"
	"time"

	"ki-web/backend/internal/api"
	httpserver "ki-web/backend/internal/http"
)

// Anforderung #4: Kontaktseite mit Nachrichtenformular und Eingang im Redaktionssystem.

const contactPath = "/api/contact-messages"

func contactMessage(name, company, email, message string, lang api.Lang) api.ContactMessageInput {
	in := api.ContactMessageInput{Name: name, Email: email, Message: message, Lang: lang}
	if company != "" {
		in.Company = &company
	}
	return in
}

// listContactMessages liest die Nachrichten so, wie die Redaktion sie sieht.
func listContactMessages(t *testing.T, b *browser) []api.ContactMessage {
	t.Helper()
	resp, body := b.do(http.MethodGet, "/api/admin/contact-messages", nil)
	wantStatus(t, resp, body, http.StatusOK)
	return decode[api.ContactMessageList](t, body).Items
}

// Eine gültige Nachricht ist danach für editor und admin mit allen Angaben sichtbar, neueste zuerst.
func TestContactMessageReachesEditorialTeam(t *testing.T) {
	srv, db := newServerWithAccounts(t)
	visitor := newBrowser(t, srv)
	before := time.Now().Add(-time.Second)

	resp, body := visitor.do(http.MethodPost, contactPath,
		contactMessage("  Erika Muster ", " Beispiel GmbH ", " Erika@Beispiel.DE ", "  Erste Nachricht\nmit zwei Zeilen  ", api.De))
	wantStatus(t, resp, body, http.StatusNoContent)
	if c := resp.Header.Values("Set-Cookie"); len(c) > 0 {
		t.Errorf("Nachricht setzt Cookies: %v", c)
	}
	// Unternehmen ist optional.
	resp, body = visitor.do(http.MethodPost, contactPath, contactMessage("Jane Doe", "", "jane@example.org", "Second message", api.En))
	wantStatus(t, resp, body, http.StatusNoContent)

	for _, email := range []string{editorEmail, adminEmail} {
		b := newBrowser(t, srv)
		b.mustLogin(email)
		items := listContactMessages(t, b)
		if len(items) != 2 {
			t.Fatalf("%s: %d Nachrichten, erwartet 2: %+v", email, len(items), items)
		}
		newest, older := items[0], items[1]
		if newest.Name != "Jane Doe" || newest.Company != "" || newest.Email != "jane@example.org" ||
			newest.Message != "Second message" || newest.Lang != api.En {
			t.Errorf("%s: neueste Nachricht %+v", email, newest)
		}
		if older.Name != "Erika Muster" || older.Company != "Beispiel GmbH" || older.Email != "erika@beispiel.de" ||
			older.Message != "Erste Nachricht\nmit zwei Zeilen" || older.Lang != api.De || older.ReceivedAt.Before(before) {
			t.Errorf("%s: ältere Nachricht %+v", email, older)
		}
	}
	if n := count(t, db, "contact_messages"); n != 2 {
		t.Fatalf("%d Einträge in der Datenbank", n)
	}
}

// Fehlende Pflichtangaben, ungültige Adressen und zu lange Angaben werden nicht angenommen.
func TestContactMessageRejectsInvalidInput(t *testing.T) {
	srv, db := newServer(t, false)
	b := newBrowser(t, srv)
	const ok = "erika@beispiel.de"
	for name, in := range map[string]api.ContactMessageInput{
		"Name fehlt":            contactMessage("", "", ok, "Hallo", api.De),
		"Name nur Leerzeichen":  contactMessage("   ", "", ok, "Hallo", api.De),
		"E-Mail fehlt":          contactMessage("Erika", "", "", "Hallo", api.De),
		"E-Mail ohne Domain":    contactMessage("Erika", "", "max.mustermann@", "Hallo", api.De),
		"E-Mail mit Umbruch":    contactMessage("Erika", "", ok+"\nBcc: x@y.de", "Hallo", api.De),
		"Nachricht fehlt":       contactMessage("Erika", "", ok, "", api.De),
		"Nachricht Leerzeichen": contactMessage("Erika", "", ok, " \n\t ", api.De),
		"Name zu lang":          contactMessage(strings.Repeat("ä", 201), "", ok, "Hallo", api.De),
		"Unternehmen zu lang":   contactMessage("Erika", strings.Repeat("x", 201), ok, "Hallo", api.De),
		"Nachricht zu lang":     contactMessage("Erika", "", ok, strings.Repeat("ü", 5001), api.De),
		"unbekannte Sprache":    contactMessage("Erika", "", ok, "Hallo", "fr"),
		"Sprache fehlt":         {Name: "Erika", Email: ok, Message: "Hallo"},
	} {
		resp, body := b.do(http.MethodPost, contactPath, in)
		if resp.StatusCode != http.StatusUnprocessableEntity {
			t.Errorf("%s: Status %d, erwartet 422 (%s)", name, resp.StatusCode, body)
		}
	}
	// Grenzwerte sind erlaubt: genau 200 bzw. 5000 Zeichen, auch mit Umlauten.
	resp, body := b.do(http.MethodPost, contactPath,
		contactMessage(strings.Repeat("ä", 200), strings.Repeat("ö", 200), ok, strings.Repeat("ü", 5000), api.De))
	wantStatus(t, resp, body, http.StatusNoContent)
	if n := count(t, db, "contact_messages"); n != 1 {
		t.Fatalf("%d Nachrichten gespeichert, erwartet 1", n)
	}
}

// Wie alle öffentlichen Schreibzugriffe: Herkunft prüfen, Größe begrenzen.
func TestContactMessageChecksOriginAndSize(t *testing.T) {
	srv, db := newServer(t, false)
	b := newBrowser(t, srv)
	valid := contactMessage("Erika", "", "erika@beispiel.de", "Hallo", api.De)
	resp, body := b.do(http.MethodPost, contactPath, valid, "Origin", "https://fremd.example")
	wantStatus(t, resp, body, http.StatusForbidden)
	resp, body = b.do(http.MethodPost, contactPath, valid, "Sec-Fetch-Site", "cross-site")
	wantStatus(t, resp, body, http.StatusForbidden)
	resp, body = b.do(http.MethodPost, contactPath, contactMessage("Erika", "", "erika@beispiel.de", strings.Repeat("x", 70<<10), api.De))
	wantStatus(t, resp, body, http.StatusRequestEntityTooLarge)
	if n := count(t, db, "contact_messages"); n != 0 {
		t.Fatalf("%d Nachrichten gespeichert", n)
	}
}

// Die Begrenzung je IP-Adresse lässt reguläre Nutzung und wiederholte Testläufe zu (mindestens 100 Nachrichten
// je Stunde), bremst aber massenhaftes Einliefern. Andere IP-Adressen sind nicht betroffen.
func TestContactMessagesAreLimitedPerIP(t *testing.T) {
	srv, db := newServer(t, false, func(c *httpserver.Config) {
		c.TrustedProxies = []netip.Prefix{netip.MustParsePrefix("127.0.0.0/8"), netip.MustParsePrefix("::1/128")}
	})
	b := newBrowser(t, srv)
	send := func(email, ip string) int {
		t.Helper()
		resp, _ := b.do(http.MethodPost, contactPath, contactMessage("Erika", "", email, "Hallo", api.De), "X-Forwarded-For", ip)
		return resp.StatusCode
	}
	for i := range 3 {
		if got := send("ungueltig", "203.0.113.7"); got != http.StatusUnprocessableEntity {
			t.Fatalf("ungültige Nachricht %d: Status %d", i, got)
		}
	}
	for i := 1; i <= 100; i++ {
		if got := send(fmt.Sprintf("person%d@beispiel.de", i), "203.0.113.7"); got != http.StatusNoContent {
			t.Fatalf("Nachricht %d: Status %d, erwartet 204", i, got)
		}
	}
	resp, body := b.do(http.MethodPost, contactPath, contactMessage("Erika", "", "zuviel@beispiel.de", "Hallo", api.De), "X-Forwarded-For", "203.0.113.7")
	wantStatus(t, resp, body, http.StatusTooManyRequests)
	if got := send("andere@beispiel.de", "198.51.100.2"); got != http.StatusNoContent {
		t.Fatalf("andere IP-Adresse: Status %d, erwartet 204", got)
	}
	if n := count(t, db, "contact_messages"); n != 101 {
		t.Fatalf("%d Nachrichten gespeichert, erwartet 101", n)
	}
}

// Nachrichten enthalten personenbezogene Daten: Ohne Redaktionssitzung sind sie weder per API noch als Seite
// einsehbar; die Seite des Nachrichtenbereichs öffnen editor und admin.
func TestContactMessagesRequireEditorialSession(t *testing.T) {
	srv, _ := newServerWithAccounts(t)
	visitor := newBrowser(t, srv)
	resp, body := visitor.do(http.MethodPost, contactPath, contactMessage("Erika", "", "geheim@beispiel.de", "Hallo", api.De))
	wantStatus(t, resp, body, http.StatusNoContent)

	resp, body = visitor.do(http.MethodGet, "/api/admin/contact-messages", nil)
	wantStatus(t, resp, body, http.StatusUnauthorized)
	if strings.Contains(body, "geheim") {
		t.Fatalf("Nachrichten ohne Anmeldung sichtbar: %s", body)
	}
	resp, _ = visitor.do(http.MethodGet, "/redaktion/nachrichten", nil)
	wantRedirect(t, resp, "/redaktion/anmelden")

	for _, email := range []string{editorEmail, adminEmail} {
		b := newBrowser(t, srv)
		b.mustLogin(email)
		resp, body := b.do(http.MethodGet, "/redaktion/nachrichten", nil)
		wantStatus(t, resp, body, http.StatusOK)
	}
}

// Die Kontaktseite ist in beiden Sprachen öffentlich erreichbar und steht in der Sitemap.
func TestContactPageIsPublic(t *testing.T) {
	srv, _ := newServer(t, false)
	b := newBrowser(t, srv)
	for _, p := range []string{"/de/kontakt", "/en/kontakt"} {
		resp, body := b.do(http.MethodGet, p, nil)
		wantStatus(t, resp, body, http.StatusOK)
	}
	resp, body := b.do(http.MethodGet, "/sitemap.xml", nil)
	wantStatus(t, resp, body, http.StatusOK)
	for _, p := range []string{"/de/kontakt", "/en/kontakt"} {
		if !strings.Contains(body, p+"<") {
			t.Errorf("Sitemap ohne %s", p)
		}
	}
}
