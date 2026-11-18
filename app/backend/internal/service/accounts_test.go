package service

import (
	"context"
	"database/sql"
	"errors"
	"io"
	"io/fs"
	"log/slog"
	"path/filepath"
	"strings"
	"testing"

	"github.com/pressly/goose/v3"

	"ki-web/backend/internal/auth"
	"ki-web/backend/internal/store"
	"ki-web/backend/migrations"
)

// Unit-Tests zu Ticket #64 (Konten mit mehreren Rollen und eigenem Profil) gegen eine echte SQLite-Datenbank.
// Sollwerte stammen aus der Spezifikation REQ-64.

const testPassword = "startpass10"

func newAccountsTest(t *testing.T) (*Accounts, *sql.DB) {
	t.Helper()
	db, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := store.Migrate(context.Background(), db, false, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatal(err)
	}
	return NewAccounts(db), db
}

func mustCreate(t *testing.T, a *Accounts, email string, roles ...Role) User {
	t.Helper()
	u, err := a.CreateUser(context.Background(), email, testPassword, Roles(roles))
	if err != nil {
		t.Fatalf("Konto %s anlegen: %v", email, err)
	}
	return u
}

func countUsers(t *testing.T, db *sql.DB) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestREQ64AC1KontoMitMehrerenRollenAnlegen(t *testing.T) {
	a, _ := newAccountsTest(t)
	ctx := context.Background()
	u := mustCreate(t, a, "Mehr.Rollen@Example.test", RoleMarketing, RoleEditor)
	if u.Email != "mehr.rollen@example.test" {
		t.Errorf("E-Mail wird normalisiert gespeichert, erhalten %q", u.Email)
	}
	if !u.Roles.Has(RoleEditor) || !u.Roles.Has(RoleMarketing) || u.Roles.Has(RoleAdmin) {
		t.Errorf("Rollen editor und marketing erwartet, erhalten %v", u.Roles)
	}
	sess, err := a.Login(ctx, "mehr.rollen@example.test", testPassword)
	if err != nil {
		t.Fatal(err)
	}
	id, err := a.Authenticate(ctx, sess.Token)
	if err != nil {
		t.Fatal(err)
	}
	if !id.Roles.CanEditPosts() || !id.Roles.CanViewInsights() || id.Roles.CanManageUsers() {
		t.Errorf("REQ-64-AC6: Sitzung trägt beide Rollen, erhalten %v", id.Roles)
	}
}

func TestREQ64AC1OhneRolleKeinKonto(t *testing.T) {
	a, db := newAccountsTest(t)
	before := countUsers(t, db)
	_, err := a.CreateUser(context.Background(), "ohne.rolle@example.test", testPassword, Roles{})
	var verr *ValidationError
	if !errors.As(err, &verr) {
		t.Fatalf("Anlage ohne Rolle muss als Eingabefehler abgewiesen werden, erhalten %v", err)
	}
	if countUsers(t, db) != before {
		t.Fatal("Anlage ohne Rolle darf kein Konto erzeugen")
	}
}

func TestREQ64AC2UngueltigeOderBelegteAdresse(t *testing.T) {
	a, db := newAccountsTest(t)
	mustCreate(t, a, "belegt@example.test", RoleEditor)
	before := countUsers(t, db)
	for _, email := range []string{"", "   ", "anna.example.org", "anna@localhost"} {
		_, err := a.CreateUser(context.Background(), email, testPassword, Roles{RoleEditor})
		var verr *ValidationError
		if !errors.As(err, &verr) || verr.Msg == "" {
			t.Errorf("Adresse %q: verständlicher Eingabefehler erwartet, erhalten %v", email, err)
		}
	}
	if _, err := a.CreateUser(context.Background(), "BELEGT@example.test", testPassword, Roles{RoleMarketing}); !errors.Is(err, ErrEmailTaken) {
		t.Errorf("belegte Adresse (andere Schreibweise): ErrEmailTaken erwartet, erhalten %v", err)
	}
	if countUsers(t, db) != before {
		t.Fatal("abgewiesene Adressen dürfen kein Konto erzeugen")
	}
}

func TestREQ64AC2AnzeigenameIstKeinBenutzername(t *testing.T) {
	a, _ := newAccountsTest(t)
	u := mustCreate(t, a, "name@example.test", RoleEditor)
	if _, err := a.SetDisplayName(context.Background(), u.ID, "Erika Muster"); err != nil {
		t.Fatal(err)
	}
	if _, err := a.Login(context.Background(), "Erika Muster", testPassword); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("Anmeldung mit Anzeigenamen muss scheitern, erhalten %v", err)
	}
}

func TestREQ64AC3AdminRolleNichtEntziehbar(t *testing.T) {
	a, _ := newAccountsTest(t)
	ctx := context.Background()
	actor := mustCreate(t, a, "chef@example.test", RoleAdmin)
	other := mustCreate(t, a, "zweiter.admin@example.test", RoleAdmin, RoleMarketing)
	for _, target := range []User{actor, other} {
		_, err := a.SetRoles(ctx, actor.ID, target.ID, Roles{RoleEditor, RoleMarketing})
		if !errors.Is(err, ErrAdminFixed) {
			t.Errorf("%s: Entzug der Admin-Rolle muss abgewiesen werden, erhalten %v", target.Email, err)
		}
	}
	users, err := a.Users(ctx)
	if err != nil {
		t.Fatal(err)
	}
	for _, u := range users {
		if !u.Roles.Has(RoleAdmin) {
			t.Errorf("%s hat die Admin-Rolle verloren: %v", u.Email, u.Roles)
		}
	}
}

func TestREQ64AC3AdminRolleVergebenUndWeitereRollenAendern(t *testing.T) {
	a, _ := newAccountsTest(t)
	ctx := context.Background()
	actor := mustCreate(t, a, "chef@example.test", RoleAdmin)
	u := mustCreate(t, a, "redaktion@example.test", RoleEditor)

	got, err := a.SetRoles(ctx, actor.ID, u.ID, Roles{RoleMarketing})
	if err != nil {
		t.Fatal(err)
	}
	if got.Roles.Has(RoleEditor) || !got.Roles.Has(RoleMarketing) {
		t.Fatalf("REQ-64-AC1: Rollen werden ersetzt, erhalten %v", got.Roles)
	}
	got, err = a.SetRoles(ctx, actor.ID, u.ID, Roles{RoleAdmin, RoleMarketing})
	if err != nil || !got.Roles.Has(RoleAdmin) {
		t.Fatalf("Entscheidung 1: Admins dürfen die Admin-Rolle vergeben, erhalten %v, %v", got.Roles, err)
	}
	if _, err := a.SetRoles(ctx, actor.ID, u.ID, Roles{}); err == nil {
		t.Fatal("REQ-64-AC1: Rollenänderung ohne Rolle muss abgewiesen werden")
	}
	if _, err := a.SetRoles(ctx, actor.ID, 999999, Roles{RoleEditor}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unbekanntes Konto: ErrNotFound erwartet, erhalten %v", err)
	}
}

func TestREQ64AC7PasswortAendern(t *testing.T) {
	a, _ := newAccountsTest(t)
	ctx := context.Background()
	mustCreate(t, a, "pw@example.test", RoleMarketing)
	current, err := a.Login(ctx, "pw@example.test", testPassword)
	if err != nil {
		t.Fatal(err)
	}
	other, err := a.Login(ctx, "pw@example.test", testPassword)
	if err != nil {
		t.Fatal(err)
	}

	// Abgelehnte Änderungen lassen das bisherige Passwort gültig.
	if err := a.ChangePassword(ctx, current.Identity, "falsch-falsch", "neues-passwort-1"); !errors.Is(err, ErrWrongPassword) {
		t.Errorf("falsches aktuelles Passwort: ErrWrongPassword erwartet, erhalten %v", err)
	}
	var verr *ValidationError
	if err := a.ChangePassword(ctx, current.Identity, testPassword, "kurz"); !errors.As(err, &verr) {
		t.Errorf("zu kurzes neues Passwort: Eingabefehler erwartet, erhalten %v", err)
	}
	if _, err := a.Login(ctx, "pw@example.test", testPassword); err != nil {
		t.Fatalf("nach abgelehnter Änderung gilt das alte Passwort weiter: %v", err)
	}

	if err := a.ChangePassword(ctx, current.Identity, testPassword, "neues-passwort-1"); err != nil {
		t.Fatal(err)
	}
	if _, err := a.Login(ctx, "pw@example.test", testPassword); !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("altes Passwort muss abgewiesen werden, erhalten %v", err)
	}
	if _, err := a.Login(ctx, "pw@example.test", "neues-passwort-1"); err != nil {
		t.Errorf("neues Passwort muss gelten: %v", err)
	}
	if _, err := a.Authenticate(ctx, current.Token); err != nil {
		t.Errorf("aktuelle Sitzung bleibt gültig: %v", err)
	}
	if _, err := a.Authenticate(ctx, other.Token); !errors.Is(err, ErrUnauthenticated) {
		t.Errorf("andere Sitzungen enden, erhalten %v", err)
	}
}

func TestREQ64AC8Anzeigename(t *testing.T) {
	a, _ := newAccountsTest(t)
	ctx := context.Background()
	u := mustCreate(t, a, "profil@example.test", RoleEditor)
	p, err := a.SetDisplayName(ctx, u.ID, "  Erika Muster  ")
	if err != nil {
		t.Fatal(err)
	}
	if p.DisplayName != "Erika Muster" {
		t.Errorf("Anzeigename wird getrimmt gespeichert, erhalten %q", p.DisplayName)
	}
	again, err := a.Profile(ctx, u.ID)
	if err != nil || again.DisplayName != "Erika Muster" {
		t.Fatalf("Anzeigename beim erneuten Öffnen erwartet, erhalten %q, %v", again.DisplayName, err)
	}
	if !again.Roles.Has(RoleEditor) || len(again.Roles) != 1 {
		t.Errorf("Profiländerung darf Rollen nicht ändern, erhalten %v", again.Roles)
	}

	var verr *ValidationError
	if _, err := a.SetDisplayName(ctx, u.ID, strings.Repeat("ä", 81)); !errors.As(err, &verr) {
		t.Errorf("81 Zeichen müssen abgewiesen werden, erhalten %v", err)
	}
	if p, err := a.SetDisplayName(ctx, u.ID, strings.Repeat("ä", 80)); err != nil || p.DisplayName != strings.Repeat("ä", 80) {
		t.Errorf("80 Zeichen sind erlaubt, erhalten %v", err)
	}
	if p, err := a.SetDisplayName(ctx, u.ID, ""); err != nil || p.DisplayName != "" {
		t.Errorf("leerer Anzeigename ist erlaubt, erhalten %q, %v", p.DisplayName, err)
	}
}

// REQ-64-AC10: Bestehende Konten behalten Zugangsdaten und erhalten ihre bisherige Rolle.
func TestREQ64AC10BestehendeKontenNachMigration(t *testing.T) {
	ctx := context.Background()
	db, err := store.Open(filepath.Join(t.TempDir(), "alt.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	sub, err := fs.Sub(migrations.Schema, ".")
	if err != nil {
		t.Fatal(err)
	}
	p, err := goose.NewProvider(goose.DialectSQLite3, db, sub, goose.WithTableName("goose_db_version"), goose.WithDisableGlobalRegistry(true))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := p.UpTo(ctx, 19); err != nil { // Stand vor Ticket #64
		t.Fatal(err)
	}
	hash, err := auth.HashPassword(testPassword)
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range [][2]string{{"alt.admin@example.test", "admin"}, {"alt.redaktion@example.test", "editor"}} {
		if _, err := db.Exec(`INSERT INTO users (email, password_hash, role, active, created_at) VALUES (?, ?, ?, TRUE, '2026-11-01T00:00:00Z')`, row[0], hash, row[1]); err != nil {
			t.Fatal(err)
		}
	}
	if err := store.Migrate(ctx, db, false, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatal(err)
	}
	a := NewAccounts(db)
	want := map[string]Roles{"alt.admin@example.test": {RoleAdmin}, "alt.redaktion@example.test": {RoleEditor}}
	for email, roles := range want {
		sess, err := a.Login(ctx, email, testPassword)
		if err != nil {
			t.Fatalf("%s: Anmeldung mit bisherigen Zugangsdaten: %v", email, err)
		}
		if len(sess.Identity.Roles) != 1 || sess.Identity.Roles[0] != roles[0] {
			t.Errorf("%s: Rollen %v erwartet, erhalten %v", email, roles, sess.Identity.Roles)
		}
	}
}
