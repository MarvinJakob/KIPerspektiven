package service

import "slices"

// Role ist eine Rolle eines Redaktionskontos (Ticket #64, ARCHITECTURE.md, Abschnitt 4).
type Role string

const (
	// RoleAdmin darf alle Bereiche und Aktionen einschließlich der Benutzerverwaltung.
	RoleAdmin Role = "admin"
	// RoleEditor (Redakteur) verwaltet Beiträge.
	RoleEditor Role = "editor"
	// RoleMarketing liest Statistik, Nachrichten und Beratungsanfragen.
	RoleMarketing Role = "marketing"
)

// roleOrder ist die feste Reihenfolge für Ausgabe und Vergleich.
var roleOrder = []Role{RoleAdmin, RoleEditor, RoleMarketing}

// ParseRole prüft eine einzelne Rollenangabe.
func ParseRole(s string) (Role, bool) {
	r := Role(s)
	return r, slices.Contains(roleOrder, r)
}

// Roles ist die Menge der Rollen eines Kontos in fester Reihenfolge (admin, editor, marketing).
// Mehrere Rollen addieren ihre Rechte.
type Roles []Role

// ParseRoles prüft Rollenangaben, entfernt Doppelte und sortiert. Ohne Rolle oder mit unbekannter Rolle
// liefert es einen ValidationError.
func ParseRoles(in []string) (Roles, error) {
	seen := map[Role]bool{}
	for _, s := range in {
		r, ok := ParseRole(s)
		if !ok {
			return nil, invalid("Unbekannte Rolle. Erlaubt sind Admin, Redakteur und Marketing.")
		}
		seen[r] = true
	}
	out := Roles{}
	for _, r := range roleOrder {
		if seen[r] {
			out = append(out, r)
		}
	}
	if len(out) == 0 {
		return nil, invalid("Bitte mindestens eine Rolle wählen.")
	}
	return out, nil
}

// normalize sortiert bereits geprüfte Rollen in die feste Reihenfolge und entfernt Doppelte.
func (rs Roles) normalize() Roles {
	out := Roles{}
	for _, r := range roleOrder {
		if rs.Has(r) {
			out = append(out, r)
		}
	}
	return out
}

// Strings liefert die Rollen als Zeichenketten.
func (rs Roles) Strings() []string {
	out := make([]string, len(rs))
	for i, r := range rs {
		out[i] = string(r)
	}
	return out
}

// Has meldet, ob die Rolle enthalten ist.
func (rs Roles) Has(r Role) bool { return slices.Contains(rs, r) }

// CanEditPosts: Beitragssystem (Admin, Redakteur).
func (rs Roles) CanEditPosts() bool { return rs.Has(RoleAdmin) || rs.Has(RoleEditor) }

// CanViewInsights: Statistik, Nachrichten und Beratungsanfragen lesen (Admin, Marketing).
func (rs Roles) CanViewInsights() bool { return rs.Has(RoleAdmin) || rs.Has(RoleMarketing) }

// CanDeleteConsultations: Beratungsanfragen löschen (nur Admin).
func (rs Roles) CanDeleteConsultations() bool { return rs.Has(RoleAdmin) }

// CanDeleteContactMessages: einzelne Nachrichten der Kontaktseite löschen (Admin, Marketing; Ticket #90).
func (rs Roles) CanDeleteContactMessages() bool { return rs.CanViewInsights() }

// CanManageUsers: Benutzerverwaltung (nur Admin).
func (rs Roles) CanManageUsers() bool { return rs.Has(RoleAdmin) }

// CanAuthor: als Autor eines Beitrags wählbar (Admin, Redakteur).
func (rs Roles) CanAuthor() bool { return rs.CanEditPosts() }

// Legacy ist der Wert für die frühere Spalte users.role, die nur admin und editor kennt. Sie wird weiter
// gepflegt, damit eine Version vor #64 nach einem Rollback startet (docs/betrieb.md).
func (rs Roles) Legacy() Role {
	if rs.Has(RoleAdmin) {
		return RoleAdmin
	}
	return RoleEditor
}
