package web

import (
	"encoding/json"
	"html"
	"image"
	_ "image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"ki-web/backend/internal/audit"
	"ki-web/backend/internal/service"
)

// Unit-Tests zu Anforderung #124: strukturierte Daten (JSON-LD), Standard-Vorschaubild und Datumsangaben im
// HTML des Direktaufrufs. Sollwerte aus den Akzeptanzkriterien und Entscheidungen E1/E2 im Ticket, die
// Seitennamen aus der Tabelle in #108, die bisherigen Kopfangaben aus der Messung der Produktionsseite vom
// 20.11.2026. Fidelity-Tests: app/e2e/tests/124-strukturierte-daten.spec.ts.

const (
	testBase     = "https://example.test"
	defaultImage = testBase + "/vorschaubild-1200x630.png"
)

var (
	jsonLDBlock = regexp.MustCompile(`(?s)<script type="application/ld\+json">(.*?)</script>`)
	metaTag     = regexp.MustCompile(`<meta (?:name|property)="([^"]+)" content="([^"]*)">`)
	canonical   = regexp.MustCompile(`<link rel="canonical" href="([^"]*)">`)
)

// head ist das ausgewertete HTML einer Seite.
type head struct {
	html   string
	meta   map[string]string
	blocks []map[string]any
}

func parseHead(t *testing.T, m Meta) head {
	t.Helper()
	out, err := render([]byte(fallbackIndex), m)
	if err != nil {
		t.Fatal(err)
	}
	h := head{html: string(out), meta: map[string]string{}}
	for _, x := range metaTag.FindAllStringSubmatch(h.html, -1) {
		h.meta[x[1]] = html.UnescapeString(x[2])
	}
	if c := canonical.FindStringSubmatch(h.html); c != nil {
		h.meta["canonical"] = html.UnescapeString(c[1])
	}
	for _, x := range jsonLDBlock.FindAllStringSubmatch(h.html, -1) {
		var v map[string]any
		if err := json.Unmarshal([]byte(x[1]), &v); err != nil {
			t.Fatalf("JSON-LD-Block ist kein gültiges JSON: %v\n%s", err, x[1])
		}
		h.blocks = append(h.blocks, v)
	}
	return h
}

// one liefert den einzigen JSON-LD-Block der Seite.
func (h head) one(t *testing.T, ac string) map[string]any {
	t.Helper()
	if n := strings.Count(h.html, "application/ld+json"); n != 1 || len(h.blocks) != 1 {
		t.Fatalf("%s: HTML enthält %d JSON-LD-Blöcke, erwartet genau 1:\n%s", ac, n, h.html)
	}
	if got := h.blocks[0]["@context"]; got != "https://schema.org" {
		t.Errorf("%s: @context = %v, erwartet https://schema.org", ac, got)
	}
	return h.blocks[0]
}

func resolvePath(t *testing.T, s *Site, p string) (int, Meta) {
	t.Helper()
	status, m, err := s.resolve(httptest.NewRequest(http.MethodGet, "/"+p, nil), strings.Split(p, "/"))
	if err != nil {
		t.Fatal(err)
	}
	return status, m
}

func expectField(t *testing.T, ac string, obj map[string]any, key string, want any) {
	t.Helper()
	if got := obj[key]; got != want {
		t.Errorf("%s: %s = %#v, erwartet %#v", ac, key, got, want)
	}
}

func object(t *testing.T, ac string, obj map[string]any, key string) map[string]any {
	t.Helper()
	v, ok := obj[key].(map[string]any)
	if !ok {
		t.Fatalf("%s: %s = %#v, erwartet ein Objekt", ac, key, obj[key])
	}
	return v
}

// expectWebSite prüft die WebSite aus REQ-124-AC1 für die Sprache der angezeigten Fassung.
func expectWebSite(t *testing.T, ac string, obj map[string]any, lang string) {
	t.Helper()
	expectField(t, ac, obj, "@type", "WebSite")
	expectField(t, ac, obj, "name", "KI Perspektiven")
	expectField(t, ac, obj, "url", testBase+"/"+lang)
	expectField(t, ac, obj, "inLanguage", lang)
}

// expectDefaultImage prüft die Angaben zum Standard-Vorschaubild (REQ-124-AC5).
func expectDefaultImage(t *testing.T, h head, lang string) {
	t.Helper()
	alt := map[string]string{"de": "Logo von KI Perspektiven", "en": "KI Perspektiven logo"}[lang]
	for key, want := range map[string]string{
		"og:image": defaultImage, "twitter:image": defaultImage, "og:image:width": "1200", "og:image:height": "630",
		"og:image:alt": alt, "twitter:card": "summary_large_image",
	} {
		if got := h.meta[key]; got != want {
			t.Errorf("REQ-124-AC5: %s = %q, erwartet %q", key, got, want)
		}
	}
}

func TestREQ124AC1Website(t *testing.T) {
	s := &Site{baseURL: testBase}
	for path, lang := range map[string]string{"": "de", "de": "de", "en": "en"} {
		t.Run("/"+path, func(t *testing.T) {
			status, m := resolvePath(t, s, path)
			if status != http.StatusOK {
				t.Errorf("Status = %d, erwartet 200", status)
			}
			h := parseHead(t, m)
			ld := h.one(t, "REQ-124-AC1")
			expectWebSite(t, "REQ-124-AC1", ld, lang)
			expectField(t, "REQ-124-AC1", ld, "url", h.meta["canonical"])
			expectDefaultImage(t, h, lang)
		})
	}
}

// Seitennamen laut Tabelle in #108; Beschreibungen der deutschen Seiten aus der Messung der Produktionsseite.
// Impressum und Datenschutz folgen dem Ziel „jede öffentliche, indexierbare Seite“ (Spezifikation S1).
func TestREQ124AC10WebPageStatischeSeiten(t *testing.T) {
	cases := []struct{ path, lang, canonical, name, desc string }{
		{"de/blog", "de", "/de/blog", "News", "Alle veröffentlichten Beiträge rund um KI – die neuesten zuerst."},
		{"en/blog", "en", "/en/blog", "News", "All published articles about AI – newest first."},
		{"de/kontakt", "de", "/de/kontakt", "Kontakt", "Schreib uns eine Nachricht – mit deinen Kontaktdaten, damit wir antworten können."},
		{"en/kontakt", "en", "/en/kontakt", "Contact", "Send us a message – with your contact details so that we can reply."},
		{"de/ki-einsatzfelder", "de", "/de/ki-einsatzfelder", "Wofür KI heute eingesetzt wird", "Sieben typische Aufgaben von KI mit belegten Beispielen und Zahlen zur KI-Nutzung in Deutschland."},
		{"en/ki-einsatzfelder", "en", "/en/ki-einsatzfelder", "What AI is used for today", "Seven typical tasks of AI with documented examples and figures on AI use in Germany."},
		{"de/ki-verstehen", "de", "/de/ki-verstehen", "KI verstehen", "Wie Sprachmodelle und KI-Agenten funktionieren und wie fünf Disziplinen helfen, bessere KI-Ergebnisse zu erreichen."},
		// REQ-124-AC8: Die Seite liegt nur auf Deutsch vor; die englische Adresse beschreibt die deutsche Fassung.
		{"en/ki-verstehen", "de", "/de/ki-verstehen", "KI verstehen", "Wie Sprachmodelle und KI-Agenten funktionieren und wie fünf Disziplinen helfen, bessere KI-Ergebnisse zu erreichen."},
		{"de/impressum", "de", "/de/impressum", "Impressum", "Impressum von KI Perspektiven."},
		{"en/impressum", "en", "/en/impressum", "Legal notice", "Legal notice of KI Perspektiven."},
		{"de/datenschutz", "de", "/de/datenschutz", "Datenschutz", "Datenschutzerklärung von KI Perspektiven."},
		{"en/datenschutz", "en", "/en/datenschutz", "Privacy", "Privacy policy of KI Perspektiven."},
	}
	s := &Site{baseURL: testBase}
	for _, c := range cases {
		t.Run("/"+c.path, func(t *testing.T) {
			_, m := resolvePath(t, s, c.path)
			h := parseHead(t, m)
			const ac = "REQ-124-AC10, REQ-124-AC8"
			ld := h.one(t, ac)
			expectField(t, ac, ld, "@type", "WebPage")
			expectField(t, ac, ld, "name", c.name)
			expectField(t, ac, ld, "description", c.desc)
			expectField(t, "REQ-124-AC11", ld, "description", h.meta["description"])
			expectField(t, ac, ld, "url", testBase+c.canonical)
			expectField(t, ac, ld, "url", h.meta["canonical"])
			expectField(t, ac, ld, "inLanguage", c.lang)
			expectWebSite(t, ac+" (isPartOf)", object(t, ac, ld, "isPartOf"), c.lang)
			expectDefaultImage(t, h, c.lang)
		})
	}
}

func TestREQ124AC10ThemenseiteUndDimension(t *testing.T) {
	s := &Site{baseURL: testBase}
	const ac = "REQ-124-AC10, REQ-124-AC8"

	// Thema liegt nur auf Englisch vor und wird unter /de/… aufgerufen: Es gilt die angezeigte Fassung.
	topic := service.TopicDetail{Topic: service.Topic{
		TopicRef: service.TopicRef{Slug: "nur-englisch", Lang: service.EN, Title: "Only English"},
		Intro:    "A short intro.", Translations: []service.Lang{service.EN},
	}}
	h := parseHead(t, s.topicMeta(service.DE, topic))
	ld := h.one(t, ac)
	expectField(t, ac, ld, "@type", "WebPage")
	expectField(t, ac, ld, "name", "Only English")
	expectField(t, ac, ld, "description", "A short intro.")
	expectField(t, ac, ld, "url", testBase+"/en/themen/nur-englisch")
	expectField(t, ac, ld, "url", h.meta["canonical"])
	expectField(t, ac, ld, "inLanguage", "en")
	expectWebSite(t, ac+" (isPartOf)", object(t, ac, ld, "isPartOf"), "en")
	expectDefaultImage(t, h, "en")
	if strings.Contains(h.html, testBase+"/de/themen/nur-englisch") {
		t.Errorf("REQ-124-AC8: HTML behauptet eine deutsche Fassung, die es nicht gibt:\n%s", h.html)
	}

	dim := audit.Dimension{DimensionSummary: audit.DimensionSummary{
		Slug: "strategie", Lang: service.DE, Title: "Strategie", Summary: "Kurz gesagt.", Intro: []string{"Erster Absatz."},
	}, Translations: service.Langs}
	h = parseHead(t, s.dimensionMeta(dim))
	ld = h.one(t, ac)
	expectField(t, ac, ld, "@type", "WebPage")
	expectField(t, ac, ld, "name", "Strategie")
	expectField(t, ac, ld, "description", "Kurz gesagt. Erster Absatz.")
	expectField(t, ac, ld, "url", testBase+"/de/themen/ai-audit/strategie")
	expectField(t, ac, ld, "inLanguage", "de")
	expectWebSite(t, ac+" (isPartOf)", object(t, ac, ld, "isPartOf"), "de")
	expectDefaultImage(t, h, "de")
}

func TestREQ124AC4Profil(t *testing.T) {
	s := &Site{baseURL: testBase}
	for _, lang := range []string{"de", "en"} {
		t.Run(lang, func(t *testing.T) {
			_, m := resolvePath(t, s, lang+"/profil")
			h := parseHead(t, m)
			const ac = "REQ-124-AC4"
			ld := h.one(t, ac)
			expectField(t, ac, ld, "@type", "ProfilePage")
			person := object(t, ac, ld, "mainEntity")
			expectField(t, ac, person, "@type", "Person")
			expectField(t, ac, person, "name", "Marvin Jakob")
			expectField(t, ac, person, "url", testBase+"/"+lang+"/profil")
			expectField(t, ac, person, "url", h.meta["canonical"])
			expectDefaultImage(t, h, lang)
		})
	}
}

var (
	published = time.Date(2026, 11, 3, 8, 15, 0, 0, time.UTC)
	modified  = time.Date(2026, 11, 19, 17, 45, 30, 0, time.UTC)
)

func testPost(lang service.Lang, title, summary string) service.Post {
	return service.Post{PostSummary: service.PostSummary{
		Slug: "ein-beitrag", Lang: lang, Title: title, Summary: summary,
		PublishedAt: published, UpdatedAt: modified, Translations: []service.Lang{lang},
	}}
}

func expectAuthor(t *testing.T, ld map[string]any, lang string) {
	t.Helper()
	for _, key := range []string{"author", "publisher"} {
		p := object(t, "REQ-124-AC2", ld, key)
		expectField(t, "REQ-124-AC2 ("+key+")", p, "@type", "Person")
		expectField(t, "REQ-124-AC2 ("+key+")", p, "name", "Marvin Jakob")
		expectField(t, "REQ-124-AC2 ("+key+")", p, "url", testBase+"/"+lang+"/profil")
	}
}

func TestREQ124AC2AC3BeitragOhneTitelbild(t *testing.T) {
	s := &Site{baseURL: testBase}
	// Beitrag liegt nur auf Deutsch vor und wird unter /en/… aufgerufen (REQ-124-AC8).
	h := parseHead(t, s.postMeta(service.EN, testPost(service.DE, "Ein Titel", "Eine Zusammenfassung.")))
	const ac = "REQ-124-AC2"
	ld := h.one(t, ac)
	expectField(t, ac, ld, "@type", "BlogPosting")
	expectField(t, ac, ld, "headline", "Ein Titel")
	expectField(t, ac, ld, "description", "Eine Zusammenfassung.")
	expectField(t, ac, ld, "datePublished", "2026-11-03T08:15:00Z")
	expectField(t, ac, ld, "dateModified", "2026-11-19T17:45:30Z")
	expectField(t, ac+", REQ-124-AC8", ld, "inLanguage", "de")
	expectField(t, ac+", REQ-124-AC8", ld, "mainEntityOfPage", testBase+"/de/blog/ein-beitrag")
	expectField(t, ac, ld, "mainEntityOfPage", h.meta["canonical"])
	expectField(t, ac, ld, "image", defaultImage)
	expectAuthor(t, ld, "de")
	if strings.Contains(h.html, "Organization") {
		t.Errorf("REQ-124-AC2: Der Typ Organization kommt in den strukturierten Daten vor:\n%s", h.html)
	}
	expectDefaultImage(t, h, "de")

	for key, want := range map[string]string{
		"article:published_time": "2026-11-03T08:15:00Z", "article:modified_time": "2026-11-19T17:45:30Z",
	} {
		if got := h.meta[key]; got != want {
			t.Errorf("REQ-124-AC3: %s = %q, erwartet %q", key, got, want)
		}
	}
}

func TestREQ124AC6TitelbildHatVorrang(t *testing.T) {
	s := &Site{baseURL: testBase}
	p := testPost(service.EN, "A title", "A summary.")
	p.Cover = &service.Image{OGImage: "/media/abc/og.jpg"}
	h := parseHead(t, s.postMeta(service.EN, p))
	const cover = testBase + "/media/abc/og.jpg"
	for _, key := range []string{"og:image", "twitter:image"} {
		if got := h.meta[key]; got != cover {
			t.Errorf("REQ-124-AC6: %s = %q, erwartet das Titelbild %q", key, got, cover)
		}
	}
	if got := h.meta["twitter:card"]; got != "summary_large_image" {
		t.Errorf("REQ-124-AC6: twitter:card = %q, erwartet summary_large_image", got)
	}
	// Größe und Alternativtext gelten nur für das Standard-Vorschaubild.
	for _, key := range []string{"og:image:width", "og:image:height", "og:image:alt"} {
		if got, ok := h.meta[key]; ok {
			t.Errorf("REQ-124-AC6: %s = %q beschreibt das Standard-Vorschaubild, obwohl das Titelbild gilt", key, got)
		}
	}
	if strings.Contains(h.html, defaultImage) {
		t.Errorf("REQ-124-AC6: HTML nennt das Standard-Vorschaubild trotz Titelbild:\n%s", h.html)
	}
	ld := h.one(t, "REQ-124-AC2")
	expectField(t, "REQ-124-AC2", ld, "image", cover)
	expectField(t, "REQ-124-AC2", ld, "inLanguage", "en")
	expectAuthor(t, ld, "en")
}

func TestREQ124AC7NichtIndexierbareSeiten(t *testing.T) {
	s := &Site{baseURL: testBase}
	for path, want := range map[string]int{
		"de/gibt-es-nicht": 404, "fr/blog": 404, "de/themenartikel/abc": 404,
		"de/themen/ai-audit/auswertung": 200, "en/themen/ai-audit/auswertung": 200,
	} {
		t.Run("/"+path, func(t *testing.T) {
			status, m := resolvePath(t, s, path)
			if status != want {
				t.Errorf("REQ-124-AC7: Status = %d, erwartet %d", status, want)
			}
			h := parseHead(t, m)
			if strings.Contains(h.html, "ld+json") {
				t.Errorf("REQ-124-AC7: nicht indexierbare Seite enthält einen JSON-LD-Block:\n%s", h.html)
			}
			if got := h.meta["robots"]; got != "noindex" {
				t.Errorf("REQ-124-AC7: robots = %q, erwartet noindex", got)
			}
		})
	}
}

func TestREQ124AC9SichereAusgabe(t *testing.T) {
	s := &Site{baseURL: testBase}
	const title = `"Zitat" <b>fett</b> </script><script>alert(1)</script> & 'mehr' <!-- x`
	const summary = `Kurz: </SCRIPT> "a" > b < c`
	h := parseHead(t, s.postMeta(service.DE, testPost(service.DE, title, summary)))
	const ac = "REQ-124-AC9"
	ld := h.one(t, ac)
	expectField(t, ac, ld, "headline", title)
	expectField(t, ac, ld, "description", summary)
	// Der Block endet erst an seinem eigenen schließenden Tag: Sein Inhalt enthält kein „<“.
	start := strings.Index(h.html, `<script type="application/ld+json">`)
	body := h.html[start+len(`<script type="application/ld+json">`):]
	body = body[:strings.Index(strings.ToLower(body), "</script")]
	if strings.Contains(body, "<") || !json.Valid([]byte(body)) {
		t.Errorf("%s: Inhalt des Blocks bis zum ersten schließenden Tag ist kein abgeschlossenes JSON ohne „<“:\n%s", ac, body)
	}
	if n := strings.Count(strings.ToLower(h.html), "<script"); n != 1 {
		t.Errorf("%s: HTML enthält %d <script>-Elemente, erwartet nur den JSON-LD-Block", ac, n)
	}
}

// REQ-124-AC11: Die bisherigen Kopfangaben bleiben zeichengenau erhalten. Sollwerte: Messung der Produktionsseite
// vom 20.11.2026 (Stand vor der Umsetzung), Adresse auf die Testbasis umgeschrieben.
func TestREQ124AC11BisherigeKopfangabenUnveraendert(t *testing.T) {
	cases := map[string][]string{
		"de": {
			`<title>KI Perspektiven</title>`,
			`<meta name="description" content="Praxiswissen für den professionellen Einsatz von KI. Mit klarem Blick auf Nutzen, Grenzen und Verantwortung.">`,
			`<link rel="canonical" href="https://example.test/de">`,
			`<link rel="alternate" hreflang="de" href="https://example.test/de">`,
			`<link rel="alternate" hreflang="en" href="https://example.test/en">`,
			`<link rel="alternate" hreflang="x-default" href="https://example.test/de">`,
			`<meta property="og:site_name" content="KI Perspektiven">`,
			`<meta property="og:type" content="website">`,
			`<meta property="og:title" content="KI verstehen. Sinnvoll einsetzen. · KI Perspektiven">`,
			`<meta property="og:description" content="Praxiswissen für den professionellen Einsatz von KI. Mit klarem Blick auf Nutzen, Grenzen und Verantwortung.">`,
			`<meta property="og:url" content="https://example.test/de">`,
			`<meta property="og:locale" content="de_DE">`,
			`<meta name="twitter:title" content="KI verstehen. Sinnvoll einsetzen. · KI Perspektiven">`,
			`<meta name="twitter:description" content="Praxiswissen für den professionellen Einsatz von KI. Mit klarem Blick auf Nutzen, Grenzen und Verantwortung.">`,
		},
		"en/profil": {
			`<title>KI Perspektiven Profile</title>`,
			`<meta name="description" content="Marvin Jakob, Creative IT Specialist: understand technology. Use AI in practice. Consulting on AI adoption, data strategy and agentic AI.">`,
			`<link rel="canonical" href="https://example.test/en/profil">`,
			`<link rel="alternate" hreflang="de" href="https://example.test/de/profil">`,
			`<link rel="alternate" hreflang="en" href="https://example.test/en/profil">`,
			`<link rel="alternate" hreflang="x-default" href="https://example.test/de/profil">`,
			`<meta property="og:title" content="Marvin Jakob – Profile · KI Perspektiven">`,
			`<meta property="og:locale" content="en_GB">`,
		},
		"en/ki-verstehen": {
			`<title>KI Perspektiven KI verstehen</title>`,
			`<link rel="canonical" href="https://example.test/de/ki-verstehen">`,
			`<link rel="alternate" hreflang="de" href="https://example.test/de/ki-verstehen">`,
			`<link rel="alternate" hreflang="x-default" href="https://example.test/de/ki-verstehen">`,
			`<meta property="og:title" content="KI verstehen · KI Perspektiven">`,
			`<meta property="og:url" content="https://example.test/de/ki-verstehen">`,
		},
	}
	s := &Site{baseURL: testBase}
	for path, lines := range cases {
		t.Run("/"+path, func(t *testing.T) {
			_, m := resolvePath(t, s, path)
			h := parseHead(t, m)
			for _, line := range lines {
				if n := strings.Count(h.html, line); n != 1 {
					t.Errorf("REQ-124-AC11: HTML enthält %q %d-mal, erwartet genau einmal", line, n)
				}
			}
			if strings.Contains(h.html, `hreflang="en" href="https://example.test/en/ki-verstehen"`) {
				t.Errorf("REQ-124-AC8: HTML behauptet eine englische Fassung von KI verstehen")
			}
		})
	}
}

// REQ-124-AC5, E2: Das Standard-Vorschaubild liegt als PNG mit 1200 × 630 Pixeln im öffentlichen Ordner des Frontends.
func TestREQ124AC5VorschaubildDatei(t *testing.T) {
	f, err := os.Open("../../../frontend/public/vorschaubild-1200x630.png")
	if err != nil {
		t.Fatalf("REQ-124-AC5: Standard-Vorschaubild fehlt: %v", err)
	}
	defer f.Close()
	cfg, format, err := image.DecodeConfig(f)
	if err != nil {
		t.Fatalf("REQ-124-AC5: Standard-Vorschaubild ist kein lesbares Bild: %v", err)
	}
	if format != "png" || cfg.Width != 1200 || cfg.Height != 630 {
		t.Errorf("REQ-124-AC5: Bild ist %s %d × %d, erwartet png 1200 × 630", format, cfg.Width, cfg.Height)
	}
}
