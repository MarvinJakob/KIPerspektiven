package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ki-web/backend/internal/service"
)

// Anforderung #76: Die Beitragsübersicht führt „News“ als Seitennamen, die Adresse /<sprache>/blog bleibt
// bestehen (REQ-76-AC3, REQ-76-AC4). Die Form des Tab-Titels legt seit Anforderung #108 REQ-108-AC1 fest.
func TestNewsOverviewTitle(t *testing.T) {
	s := &Site{baseURL: "https://example.test"}
	for _, l := range []service.Lang{service.DE, service.EN} {
		t.Run(string(l), func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/"+string(l)+"/blog", nil)
			status, m, err := s.resolve(r, []string{string(l), "blog"})
			if err != nil {
				t.Fatal(err)
			}
			if status != http.StatusOK {
				t.Errorf("REQ-76-AC4: Status für /%s/blog = %d, erwartet 200", l, status)
			}
			if want := "KI Perspektiven News"; m.Title != want {
				t.Errorf("REQ-76-AC3, REQ-108-AC1: Seitentitel = %q, erwartet %q", m.Title, want)
			}
			if want := "https://example.test/" + string(l) + "/blog"; m.Canonical != want {
				t.Errorf("REQ-76-AC4: kanonische Adresse = %q, erwartet %q", m.Canonical, want)
			}
		})
	}
}

// Anforderung #108: Der Tab-Titel beginnt mit „KI Perspektiven“; der Seitenname folgt nach genau einem
// Leerzeichen (REQ-108-AC1). Ohne Seitennamen bleibt nur der Websitename (REQ-108-AC2).
func TestTabTitle(t *testing.T) {
	cases := []struct{ name, want string }{
		{"News", "KI Perspektiven News"},
		{"Kontakt", "KI Perspektiven Kontakt"},
		{"Contact", "KI Perspektiven Contact"},
		{"", "KI Perspektiven"},
		// Ein Inhaltstitel mit Rand darf weder zwei Leerzeichen noch ein Leerzeichen am Ende erzeugen.
		{"  Titel mit Rand ", "KI Perspektiven Titel mit Rand"},
		{"   ", "KI Perspektiven"},
	}
	for _, c := range cases {
		if got := tabTitle(c.name); got != c.want {
			t.Errorf("REQ-108-AC1/AC2: tabTitle(%q) = %q, erwartet %q", c.name, got, c.want)
		}
	}
}

// Anforderung #108: Beim Direktaufruf liefert das Backend den endgültigen Tab-Titel (REQ-108-AC3). Sollwerte
// je Seite aus der Tabelle „Seitennamen“ im Ticket. Die Titel der Social-Media-Vorschau behalten die bisherige
// Form (Abgrenzung im Ticket).
func TestPublicPageTitles(t *testing.T) {
	const notFound = http.StatusNotFound
	cases := []struct {
		path   string
		status int
		ac     string
		title  string
		social string
	}{
		{"", 200, "AC2", "KI Perspektiven", "KI verstehen. Sinnvoll einsetzen. · KI Perspektiven"},
		{"de", 200, "AC2", "KI Perspektiven", "KI verstehen. Sinnvoll einsetzen. · KI Perspektiven"},
		{"en", 200, "AC2", "KI Perspektiven", "Understand AI. Use it wisely. · KI Perspektiven"},
		{"de/blog", 200, "AC1", "KI Perspektiven News", "News · KI Perspektiven"},
		{"en/blog", 200, "AC1", "KI Perspektiven News", "News · KI Perspektiven"},
		{"de/kontakt", 200, "AC1", "KI Perspektiven Kontakt", "Kontakt · KI Perspektiven"},
		{"en/kontakt", 200, "AC1", "KI Perspektiven Contact", "Contact · KI Perspektiven"},
		{"de/profil", 200, "AC1", "KI Perspektiven Profil", "Marvin Jakob – Profil · KI Perspektiven"},
		{"en/profil", 200, "AC1", "KI Perspektiven Profile", "Marvin Jakob – Profile · KI Perspektiven"},
		{"de/impressum", 200, "AC1", "KI Perspektiven Impressum", "Impressum · KI Perspektiven"},
		{"en/impressum", 200, "AC1", "KI Perspektiven Legal notice", "Legal notice · KI Perspektiven"},
		{"de/datenschutz", 200, "AC1", "KI Perspektiven Datenschutz", "Datenschutz · KI Perspektiven"},
		{"en/datenschutz", 200, "AC1", "KI Perspektiven Privacy", "Privacy · KI Perspektiven"},
		{"de/ki-einsatzfelder", 200, "AC1", "KI Perspektiven Wofür KI heute eingesetzt wird", "Wofür KI heute eingesetzt wird · KI Perspektiven"},
		{"en/ki-einsatzfelder", 200, "AC1", "KI Perspektiven What AI is used for today", "What AI is used for today · KI Perspektiven"},
		{"de/ki-verstehen", 200, "AC1", "KI Perspektiven KI verstehen", "KI verstehen · KI Perspektiven"},
		{"en/ki-verstehen", 200, "AC1", "KI Perspektiven KI verstehen", "KI verstehen · KI Perspektiven"},
		{"de/themen/ai-audit/auswertung", 200, "AC1", "KI Perspektiven Auswertung der Selbsteinschätzung", "Auswertung der Selbsteinschätzung · KI Perspektiven"},
		{"en/themen/ai-audit/auswertung", 200, "AC1", "KI Perspektiven Self-assessment results", "Self-assessment results · KI Perspektiven"},
		{"de/gibt-es-nicht", notFound, "AC1", "KI Perspektiven Seite nicht gefunden", "Seite nicht gefunden · KI Perspektiven"},
		{"en/gibt-es-nicht", notFound, "AC1", "KI Perspektiven Page not found", "Page not found · KI Perspektiven"},
		{"fr/blog", notFound, "AC1", "KI Perspektiven Seite nicht gefunden", "Seite nicht gefunden · KI Perspektiven"},
	}
	s := &Site{baseURL: "https://example.test"}
	for _, c := range cases {
		t.Run("/"+c.path, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/"+c.path, nil)
			status, m, err := s.resolve(r, strings.Split(c.path, "/"))
			if err != nil {
				t.Fatal(err)
			}
			if status != c.status {
				t.Errorf("Status = %d, erwartet %d", status, c.status)
			}
			if m.Title != c.title {
				t.Errorf("REQ-108-%s, REQ-108-AC3: Tab-Titel = %q, erwartet %q", c.ac, m.Title, c.title)
			}
			if m.SocialTitle != c.social {
				t.Errorf("REQ-108 Abgrenzung: Titel der Social-Media-Vorschau = %q, erwartet unverändert %q", m.SocialTitle, c.social)
			}
		})
	}
}

// Anforderung #108: Im ausgelieferten HTML steht der Tab-Titel im <title>; og:title und twitter:title führen
// weiter den Titel der Social-Media-Vorschau (REQ-108-AC3, Abgrenzung im Ticket).
func TestRenderSeparatesTabAndSocialTitle(t *testing.T) {
	out, err := render([]byte(fallbackIndex), Meta{
		Lang: service.EN, Title: "KI Perspektiven Contact", SocialTitle: "Contact · KI Perspektiven", OGType: "website",
	})
	if err != nil {
		t.Fatal(err)
	}
	html := string(out)
	for _, want := range []string{
		"<title>KI Perspektiven Contact</title>",
		`<meta property="og:title" content="Contact · KI Perspektiven">`,
		`<meta name="twitter:title" content="Contact · KI Perspektiven">`,
	} {
		if !strings.Contains(html, want) {
			t.Errorf("REQ-108-AC3: HTML enthält %q nicht:\n%s", want, html)
		}
	}
	if n := strings.Count(html, "<title>"); n != 1 {
		t.Errorf("REQ-108-AC3: HTML enthält %d <title>-Elemente, erwartet 1", n)
	}
}
