package service

import (
	"errors"
	"testing"
)

// Unit-Tests zu REQ-64-AC1 und REQ-64-AC3 bis REQ-64-AC6 (Ticket #64): Rechte je Rollenkombination.
// Die Sollwerte stammen aus der Rollentabelle der Spezifikation, nicht aus dem Code.

func TestREQ64RechteJeRollenkombination(t *testing.T) {
	type want struct{ posts, insights, deleteConsultations, users bool }
	cases := []struct {
		name  string
		roles Roles
		want  want
	}{
		{"REQ-64-AC4 nur Redakteur", Roles{RoleEditor}, want{posts: true}},
		{"REQ-64-AC5 nur Marketing", Roles{RoleMarketing}, want{insights: true}},
		{"REQ-64-AC6 Redakteur und Marketing", Roles{RoleEditor, RoleMarketing}, want{posts: true, insights: true}},
		{"REQ-64-AC3 nur Admin", Roles{RoleAdmin}, want{true, true, true, true}},
		{"REQ-64-AC3 Admin mit weiteren Rollen", Roles{RoleMarketing, RoleAdmin, RoleEditor}, want{true, true, true, true}},
		{"ohne Rolle", Roles{}, want{}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := want{c.roles.CanEditPosts(), c.roles.CanViewInsights(), c.roles.CanDeleteConsultations(), c.roles.CanManageUsers()}
			if got != c.want {
				t.Fatalf("Rechte %v: erhalten %+v, erwartet %+v", c.roles, got, c.want)
			}
		})
	}
}

func TestREQ64ParseRoles(t *testing.T) {
	got, err := ParseRoles([]string{"marketing", "editor", "marketing"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || !got.Has(RoleEditor) || !got.Has(RoleMarketing) || got.Has(RoleAdmin) {
		t.Fatalf("REQ-64-AC1: doppelte Rollen werden zusammengefasst, erhalten %v", got)
	}
	// Feste Reihenfolge admin, editor, marketing unabhängig von der Eingabe
	if got[0] != RoleEditor || got[1] != RoleMarketing {
		t.Fatalf("Rollen in fester Reihenfolge erwartet, erhalten %v", got)
	}
	for _, in := range [][]string{nil, {}, {"chef"}, {"editor", ""}} {
		_, err := ParseRoles(in)
		var verr *ValidationError
		if !errors.As(err, &verr) || verr.Msg == "" {
			t.Errorf("REQ-64-AC1: %q muss mit verständlicher Meldung abgewiesen werden, erhalten %v", in, err)
		}
	}
}

func TestREQ64AltRolleFuerRollback(t *testing.T) {
	// Die frühere Spalte users.role kennt nur admin und editor (Abgrenzung „Rollback“).
	cases := map[Role]Roles{
		RoleAdmin:  {RoleAdmin, RoleMarketing},
		RoleEditor: {RoleEditor},
	}
	for want, roles := range cases {
		if got := roles.Legacy(); got != want {
			t.Errorf("Legacy(%v) = %q, erwartet %q", roles, got, want)
		}
	}
	if got := (Roles{RoleMarketing}).Legacy(); got != RoleEditor {
		t.Errorf("Legacy(marketing) = %q, erwartet editor (CHECK-Bedingung der alten Spalte)", got)
	}
}
