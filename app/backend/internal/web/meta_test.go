package web

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"ki-web/backend/internal/service"
)

// Anforderung #76: Der serverseitige Seitentitel der Beitragsübersicht führt „News“ als Seitennamen,
// die Adresse /<sprache>/blog bleibt bestehen (REQ-76-AC3, REQ-76-AC4).
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
			if want := "News · KI Perspektiven"; m.Title != want {
				t.Errorf("REQ-76-AC3: Seitentitel = %q, erwartet %q", m.Title, want)
			}
			if want := "https://example.test/" + string(l) + "/blog"; m.Canonical != want {
				t.Errorf("REQ-76-AC4: kanonische Adresse = %q, erwartet %q", m.Canonical, want)
			}
		})
	}
}
