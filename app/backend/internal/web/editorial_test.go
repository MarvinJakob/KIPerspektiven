package web

import (
	"testing"

	"ki-web/backend/internal/service"
)

// Unit-Test zu REQ-64-AC1 und REQ-64-AC3 bis REQ-64-AC6 (Ticket #64): Zugriff auf die Seiten der Redaktion
// je Rollenkombination und Startseite nach der Anmeldung. Sollwerte aus der Rollentabelle der Spezifikation.

func TestREQ64SeitenJeRolle(t *testing.T) {
	var (
		editor    = service.Roles{service.RoleEditor}
		marketing = service.Roles{service.RoleMarketing}
		both      = service.Roles{service.RoleEditor, service.RoleMarketing}
		admin     = service.Roles{service.RoleAdmin}
	)
	type want struct{ editor, marketing, both, admin bool }
	cases := map[string]want{
		"":                  {true, false, true, true},
		"beitraege/neu":     {true, false, true, true},
		"beitraege/12":      {true, false, true, true},
		"statistik":         {false, true, true, true},
		"nachrichten":       {false, true, true, true},
		"beratungsanfragen": {false, true, true, true},
		"benutzer":          {false, false, false, true},
		"profil":            {true, true, true, true},
	}
	for rest, w := range cases {
		need := route(rest)
		if need == accessUnknown || need == accessPublic {
			t.Errorf("/redaktion/%s muss eine geschützte Seite sein", rest)
			continue
		}
		got := want{need.permits(editor), need.permits(marketing), need.permits(both), need.permits(admin)}
		if got != w {
			t.Errorf("/redaktion/%s: erhalten %+v, erwartet %+v", rest, got, w)
		}
	}
}

func TestREQ64StartseiteNachAnmeldung(t *testing.T) {
	cases := []struct {
		roles service.Roles
		want  string
	}{
		{service.Roles{service.RoleAdmin, service.RoleMarketing}, "/redaktion/benutzer"},
		{service.Roles{service.RoleEditor}, "/redaktion"},
		{service.Roles{service.RoleEditor, service.RoleMarketing}, "/redaktion"},
		{service.Roles{service.RoleMarketing}, "/redaktion/statistik"},
	}
	for _, c := range cases {
		if got := HomeFor(c.roles); got != c.want {
			t.Errorf("HomeFor(%v) = %q, erwartet %q", c.roles, got, c.want)
		}
	}
}

// Unit-Test zu REQ-85-AC4 (Ticket #85): Die Einstellungen der Redaktion stehen nur Admin-Konten offen.
func TestREQ85AC4EinstellungsseitenNurFuerAdmins(t *testing.T) {
	for _, rest := range []string{"einstellungen", "einstellungen/social-media", "einstellungen/social-media/linkedin"} {
		need := route(rest)
		if need != accessAdmin {
			t.Errorf("/redaktion/%s: Zugriff %v, erwartet nur Admins", rest, need)
		}
		if need.permits(service.Roles{service.RoleEditor}) || need.permits(service.Roles{service.RoleMarketing}) {
			t.Errorf("/redaktion/%s darf Redakteuren und Marketing nicht offenstehen", rest)
		}
	}
}
