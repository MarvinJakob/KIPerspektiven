package httpserver_test

import (
	"net/http"
	"os"
	"strings"
	"testing"
)

func TestUnderstandAiDirectAndMetadata(t *testing.T) {
	srv, _ := newServer(t, false)
	source, err := os.ReadFile("../../../frontend/src/pages/UnderstandAi.tsx")
	if err != nil {
		t.Fatal(err)
	}
	description := "Wie Sprachmodelle und KI-Agenten funktionieren und wie fünf Disziplinen helfen, bessere KI-Ergebnisse zu erreichen."
	if !strings.Contains(string(source), "'"+description+"'") {
		t.Fatal("Beschreibung im Frontend weicht ab")
	}
	for _, lang := range []string{"de", "en"} {
		for range 2 {
			resp, body := get(t, srv, "/"+lang+"/ki-verstehen")
			if resp.StatusCode != http.StatusOK {
				t.Fatalf("%s status: %d", lang, resp.StatusCode)
			}
			for _, want := range []string{
				`<html lang="de">`,
				`<title>KI verstehen · KI Perspektiven</title>`,
				`<meta name="description" content="` + description + `">`,
				`<link rel="canonical" href="https://example.test/de/ki-verstehen">`,
				`hreflang="de" href="https://example.test/de/ki-verstehen"`,
			} {
				if !strings.Contains(body, want) {
					t.Errorf("%s fehlt: %s", lang, want)
				}
			}
			if strings.Contains(body, `hreflang="en"`) {
				t.Error("Fallback ist keine englische Übersetzung")
			}
		}
	}
	_, sitemap := get(t, srv, "/sitemap.xml")
	if !strings.Contains(sitemap, "<loc>https://example.test/de/ki-verstehen</loc>") {
		t.Error("deutsche Seite fehlt in Sitemap")
	}
	if strings.Contains(sitemap, "/en/ki-verstehen") {
		t.Error("Sitemap darf keine fehlende Übersetzung anbieten")
	}
}
