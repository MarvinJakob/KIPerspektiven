package httpserver

import (
	"testing"
	"time"

	"ki-web/backend/internal/service"
)

// Unit-Tests zu Ticket #85: Rechte der LinkedIn-Einstellungen (REQ-85-AC4) und Schutz des OAuth-Rückrufs (REQ-85-AC2).

func TestREQ85AC4EinstellungenNurFuerAdmins(t *testing.T) {
	editor := service.Roles{service.RoleEditor}
	marketing := service.Roles{service.RoleMarketing}
	admin := service.Roles{service.RoleAdmin}
	for _, c := range []struct{ method, path string }{
		{"GET", "/api/admin/social/linkedin"},
		{"PUT", "/api/admin/social/linkedin"},
		{"POST", "/api/admin/social/linkedin/authorize"},
		{"GET", "/api/admin/social/linkedin/callback"},
		{"DELETE", "/api/admin/social/linkedin/connection"},
	} {
		if !needsSession(c.path) {
			t.Errorf("%s muss eine Sitzung verlangen", c.path)
		}
		if allowed(c.method, c.path, editor) || allowed(c.method, c.path, marketing) {
			t.Errorf("%s %s darf nur Admins offenstehen", c.method, c.path)
		}
		if !allowed(c.method, c.path, admin) {
			t.Errorf("%s %s muss Admins offenstehen", c.method, c.path)
		}
	}
	// Den LinkedIn-Status am Beitrag und die Wiederholung sieht die Redaktion (REQ-85-AC12).
	if !allowed("POST", "/api/admin/posts/12/linkedin/retry", editor) || allowed("POST", "/api/admin/posts/12/linkedin/retry", marketing) {
		t.Error("Wiederholung muss Redakteuren und nicht Marketing offenstehen")
	}
}

func TestREQ85AC2OAuthZustandEinmaligUndKontogebunden(t *testing.T) {
	now := time.Date(2026, 11, 18, 10, 0, 0, 0, time.UTC)
	s := newOAuthStates(10 * time.Minute)
	s.now = func() time.Time { return now }

	a := s.create(1)
	b := s.create(1)
	if a == "" || a == b || len(a) < 32 {
		t.Fatalf("Zustände %q und %q müssen zufällig und verschieden sein", a, b)
	}
	if s.take("unbekannt", 1) {
		t.Error("unbekannter Zustand darf nicht gelten")
	}
	if s.take(a, 2) {
		t.Error("Zustand eines anderen Kontos darf nicht gelten")
	}
	if !s.take(a, 1) {
		t.Error("gültiger Zustand muss gelten")
	}
	if s.take(a, 1) {
		t.Error("ein Zustand gilt nur einmal")
	}
	now = now.Add(11 * time.Minute)
	if s.take(b, 1) {
		t.Error("abgelaufener Zustand darf nicht gelten")
	}
}
