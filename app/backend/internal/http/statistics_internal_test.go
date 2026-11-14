package httpserver

import (
	"testing"

	"ki-web/backend/internal/service"
)

// Ticket #130: Die Statistik gehört zu den Redaktionspfaden. Ein Konto ohne Redaktionsrolle erhält 403.
// Über die API lässt sich das nicht prüfen, weil es außer editor und admin keine Rollen gibt.
func TestStatisticsNeedEditorialRole(t *testing.T) {
	for _, p := range []string{"/api/admin/statistics/page-views", "/api/admin/statistics/readiness-results"} {
		if allowed(p, service.Role("leser")) {
			t.Errorf("%s: Konto ohne Redaktionsrolle zugelassen", p)
		}
		for _, r := range []service.Role{service.RoleEditor, service.RoleAdmin} {
			if !allowed(p, r) {
				t.Errorf("%s: Rolle %s abgelehnt", p, r)
			}
		}
	}
}
