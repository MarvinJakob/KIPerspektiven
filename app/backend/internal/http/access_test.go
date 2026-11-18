package httpserver

import (
	"testing"

	"ki-web/backend/internal/service"
)

// Unit-Test zu REQ-64-AC1 und REQ-64-AC3 bis REQ-64-AC6 (Ticket #64): Rollenprüfung der geschützten API-Pfade.
// Die Sollwerte folgen der Rollentabelle der Spezifikation.

func TestREQ64APIRechteJePfad(t *testing.T) {
	var (
		editor    = service.Roles{service.RoleEditor}
		marketing = service.Roles{service.RoleMarketing}
		both      = service.Roles{service.RoleEditor, service.RoleMarketing}
		admin     = service.Roles{service.RoleAdmin}
	)
	type call struct{ method, path string }
	cases := []struct {
		call
		allowed []service.Roles
	}{
		{call{"GET", "/api/admin/posts"}, []service.Roles{editor, both, admin}},
		{call{"PUT", "/api/admin/posts/12"}, []service.Roles{editor, both, admin}},
		{call{"PUT", "/api/admin/posts/12/author"}, []service.Roles{editor, both, admin}},
		{call{"GET", "/api/admin/authors"}, []service.Roles{editor, both, admin}},
		{call{"GET", "/api/admin/statistics/page-views"}, []service.Roles{marketing, both, admin}},
		{call{"GET", "/api/admin/statistics/readiness-results"}, []service.Roles{marketing, both, admin}},
		{call{"GET", "/api/admin/contact-messages"}, []service.Roles{marketing, both, admin}},
		{call{"GET", "/api/admin/consultation-requests"}, []service.Roles{marketing, both, admin}},
		{call{"DELETE", "/api/admin/consultation-requests/3"}, []service.Roles{admin}},
		{call{"GET", "/api/admin/users"}, []service.Roles{admin}},
		{call{"POST", "/api/admin/users"}, []service.Roles{admin}},
		{call{"PATCH", "/api/admin/users/3"}, []service.Roles{admin}},
		{call{"GET", "/api/admin/unbekannt"}, []service.Roles{admin}},
		{call{"GET", "/api/profile"}, []service.Roles{editor, marketing, both, admin}},
		{call{"PATCH", "/api/profile"}, []service.Roles{editor, marketing, both, admin}},
		{call{"PUT", "/api/profile/password"}, []service.Roles{editor, marketing, both, admin}},
		{call{"PUT", "/api/profile/avatar"}, []service.Roles{editor, marketing, both, admin}},
		{call{"GET", "/api/auth/me"}, []service.Roles{editor, marketing, both, admin}},
	}
	for _, c := range cases {
		for _, roles := range []service.Roles{editor, marketing, both, admin} {
			want := false
			for _, ok := range c.allowed {
				if equalRoles(ok, roles) {
					want = true
				}
			}
			if got := allowed(c.method, c.path, roles); got != want {
				t.Errorf("%s %s mit %v: erlaubt=%v, erwartet %v", c.method, c.path, roles, got, want)
			}
		}
	}
}

func TestREQ64ProfilVerlangtSitzung(t *testing.T) {
	for _, p := range []string{"/api/profile", "/api/profile/password", "/api/profile/avatar"} {
		if !needsSession(p) {
			t.Errorf("%s muss eine Sitzung verlangen", p)
		}
	}
}

func equalRoles(a, b service.Roles) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
