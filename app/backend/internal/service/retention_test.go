package service

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"io"
	"log/slog"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"ki-web/backend/internal/store"
)

// Unit- und Fidelity-Tests zu REQ-90-AC1 und REQ-90-AC4 bis REQ-90-AC6 (Ticket #90): fristgerechte Löschung von
// Kontaktnachrichten und Beratungsanfragen. Die Sollwerte folgen den bestätigten Regeln der Spezifikation:
// Fristende sechs Kalendermonate nach Eingang beziehungsweise letzter Anfrage in deutscher Zeit, am Monatsende auf
// den letzten Tag des Zielmonats begrenzt; fällig einen Tag vor Fristende; Lauf beim Start und alle 24 Stunden.

var berlin = StatsZone

func at(y int, m time.Month, d, h, mi, s int) time.Time { return time.Date(y, m, d, h, mi, s, 0, berlin) }

func TestREQ90AC1Fristende(t *testing.T) {
	cases := []struct {
		name        string
		start, want time.Time
	}{
		{"gleicher Tag und gleiche Uhrzeit", at(2026, 11, 17, 10, 0, 0), at(2027, 5, 17, 10, 0, 0)},
		{"31.08. endet am 28.02.", at(2026, 8, 31, 12, 0, 0), at(2027, 2, 28, 12, 0, 0)},
		{"31.08. endet im Schaltjahr am 29.02.", at(2027, 8, 31, 12, 0, 0), at(2028, 2, 29, 12, 0, 0)},
		{"31.12. endet am 30.06.", at(2026, 12, 31, 23, 30, 0), at(2027, 6, 30, 23, 30, 0)},
		{"deutsche Zeit, nicht UTC", time.Date(2026, 11, 30, 23, 30, 0, 0, time.UTC), at(2027, 6, 1, 0, 30, 0)},
	}
	for _, c := range cases {
		if got := RetentionDeadline(c.start); !got.Equal(c.want) {
			t.Errorf("%s: Fristende für %s = %s, erwartet %s", c.name, c.start, got.In(berlin), c.want)
		}
	}
}

func TestREQ90AC1Faelligkeit(t *testing.T) {
	now := at(2027, 5, 17, 10, 0, 0)
	cases := []struct {
		name  string
		start time.Time
		want  bool
	}{
		{"vor sechs Monaten und einem Tag", at(2026, 11, 16, 10, 0, 0), true},
		{"genau an der Fälligkeitsgrenze (Fristende minus 24 Stunden)", at(2026, 11, 18, 10, 0, 0), true},
		{"eine Sekunde nach der Fälligkeitsgrenze", at(2026, 11, 18, 10, 0, 1), false},
		{"vor fünf Monaten", at(2026, 12, 17, 10, 0, 0), false},
	}
	for _, c := range cases {
		if got := RetentionDue(c.start, now); got != c.want {
			t.Errorf("%s: fällig=%v, erwartet %v", c.name, got, c.want)
		}
	}
	// Bei Ablauf spätestens alle 24 Stunden liegt die Löschung damit nie nach dem Fristende.
	if RetentionInterval != 24*time.Hour {
		t.Errorf("Bereinigungsintervall %s, erwartet 24h", RetentionInterval)
	}
	// Monatsenden und die Umstellung auf Sommerzeit am 28.03.2027 (Fristende eines Eingangs Ende September 2026).
	for start := at(2026, 8, 25, 0, 0, 0); start.Before(at(2026, 10, 2, 0, 0, 0)); start = start.Add(7 * time.Hour) {
		deadline := RetentionDeadline(start)
		latest := deadline.Add(-RetentionInterval) // letzter Zeitpunkt, an dem ein Lauf sie noch nicht sehen darf
		if !RetentionDue(start, latest) {
			t.Errorf("Eingang %s: %s nicht fällig, der nächste Lauf läge erst nach dem Fristende %s", start, latest, deadline)
		}
		if RetentionDue(start, latest.Add(-time.Second)) {
			t.Errorf("Eingang %s: schon vor %s fällig, Fristende %s", start, latest, deadline)
		}
	}
}

type retentionFixture struct {
	db            *sql.DB
	contact       *Contact
	consultations *Consultations
	clock         *time.Time
	mu            *sync.Mutex
}

func newRetentionFixture(t *testing.T) retentionFixture {
	t.Helper()
	ctx := context.Background()
	db, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := store.Migrate(ctx, db, false, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatal(err)
	}
	f := retentionFixture{db: db, contact: NewContact(db), consultations: NewConsultations(db), clock: new(time.Time), mu: new(sync.Mutex)}
	now := func() time.Time { f.mu.Lock(); defer f.mu.Unlock(); return *f.clock }
	f.contact.now, f.consultations.now = now, now
	return f
}

func (f retentionFixture) setClock(t time.Time) { f.mu.Lock(); *f.clock = t; f.mu.Unlock() }

func (f retentionFixture) sendContact(t *testing.T, received time.Time, name string) {
	t.Helper()
	f.setClock(received)
	in := ContactInput{Name: name, Company: "Firma " + name, Email: strings.ToLower(name) + "@example.org", Message: "Inhalt von " + name, Lang: DE}
	if err := f.contact.Send(context.Background(), in); err != nil {
		t.Fatal(err)
	}
}

func (f retentionFixture) request(t *testing.T, requested time.Time, email string) {
	t.Helper()
	f.setClock(requested)
	if err := f.consultations.Request(context.Background(), email, DE); err != nil {
		t.Fatal(err)
	}
}

func contactNames(t *testing.T, c *Contact) []string {
	t.Helper()
	msgs, err := c.List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for _, m := range msgs {
		out = append(out, m.Name)
	}
	return out
}

func consultationEmails(t *testing.T, c *Consultations) []string {
	t.Helper()
	reqs, err := c.List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for _, r := range reqs {
		out = append(out, r.Email)
	}
	return out
}

func equalStrings(a, b []string) bool { return strings.Join(a, "|") == strings.Join(b, "|") }

func TestREQ90AC1KontaktnachrichtenFristgerechtLoeschen(t *testing.T) {
	f := newRetentionFixture(t)
	now := at(2027, 5, 17, 10, 0, 0)
	f.sendContact(t, at(2026, 11, 16, 10, 0, 0), "Ueberfaellig")
	f.sendContact(t, at(2026, 11, 18, 10, 0, 0), "Grenze")
	f.sendContact(t, at(2026, 11, 18, 10, 0, 1), "Knapp")
	f.sendContact(t, at(2026, 12, 17, 10, 0, 0), "Fuenf")
	f.setClock(now)

	n, err := f.contact.DeleteExpired(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Errorf("gelöscht %d, erwartet 2", n)
	}
	if got, want := contactNames(t, f.contact), []string{"Fuenf", "Knapp"}; !equalStrings(got, want) {
		t.Errorf("verbleibend %v, erwartet %v", got, want)
	}
	var rows int
	if err := f.db.QueryRow(`SELECT count(*) FROM contact_messages WHERE name IN ('Ueberfaellig', 'Grenze')`).Scan(&rows); err != nil || rows != 0 {
		t.Errorf("fällige Nachrichten noch in der Datenbank: %d (%v)", rows, err)
	}
}

func TestREQ90AC2EinzelneKontaktnachrichtLoeschen(t *testing.T) {
	f := newRetentionFixture(t)
	f.sendContact(t, at(2027, 1, 1, 9, 0, 0), "Erste")
	f.sendContact(t, at(2027, 1, 2, 9, 0, 0), "Zweite")
	msgs, _ := f.contact.List(context.Background())
	var id int64
	for _, m := range msgs {
		if m.Name == "Erste" {
			id = m.ID
		}
	}
	if err := f.contact.Delete(context.Background(), id); err != nil {
		t.Fatal(err)
	}
	if got := contactNames(t, f.contact); !equalStrings(got, []string{"Zweite"}) {
		t.Errorf("verbleibend %v, erwartet [Zweite]", got)
	}
	if err := f.contact.Delete(context.Background(), id); !errors.Is(err, ErrNotFound) {
		t.Errorf("zweites Löschen: %v, erwartet ErrNotFound", err)
	}
}

func TestREQ90AC5BeratungsanfragenFristgerechtLoeschen(t *testing.T) {
	f := newRetentionFixture(t)
	now := at(2027, 5, 17, 10, 0, 0)
	f.request(t, at(2026, 11, 16, 10, 0, 0), "ueberfaellig@example.org")
	f.request(t, at(2026, 11, 18, 10, 0, 0), "grenze@example.org")
	f.request(t, at(2026, 11, 18, 10, 0, 1), "knapp@example.org")
	f.request(t, at(2026, 12, 17, 10, 0, 0), "fuenf@example.org")
	f.request(t, at(2026, 10, 1, 10, 0, 0), "erneut@example.org")
	f.request(t, at(2027, 4, 17, 10, 0, 0), "erneut@example.org") // erneut gesendet: Frist beginnt neu
	f.setClock(now)

	n, err := f.consultations.DeleteExpired(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Errorf("gelöscht %d, erwartet 2", n)
	}
	want := []string{"erneut@example.org", "fuenf@example.org", "knapp@example.org"}
	if got := consultationEmails(t, f.consultations); !equalStrings(got, want) {
		t.Errorf("verbleibend %v, erwartet %v", got, want)
	}
}

func TestREQ90AC5ErneuteAnfrageWaehrendDerBereinigungBleibt(t *testing.T) {
	f := newRetentionFixture(t)
	f.request(t, at(2026, 10, 1, 10, 0, 0), "parallel@example.org")
	now := at(2027, 5, 17, 10, 0, 0)
	f.setClock(now)
	f.consultations.afterSelect = func() {
		// Zwischen Auswahl und Löschung sendet dieselbe Adresse erneut.
		if err := f.consultations.Request(context.Background(), "parallel@example.org", EN); err != nil {
			t.Fatal(err)
		}
	}
	n, err := f.consultations.DeleteExpired(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("gelöscht %d, erwartet 0", n)
	}
	if got := consultationEmails(t, f.consultations); !equalStrings(got, []string{"parallel@example.org"}) {
		t.Errorf("verbleibend %v, erwartet die erneut gesendete Anfrage", got)
	}
}

// syncBuffer nimmt Protokolle aus mehreren Goroutinen auf.
type syncBuffer struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (s *syncBuffer) Write(p []byte) (int, error) { s.mu.Lock(); defer s.mu.Unlock(); return s.b.Write(p) }
func (s *syncBuffer) String() string             { s.mu.Lock(); defer s.mu.Unlock(); return s.b.String() }

func assertNoPersonalData(t *testing.T, logs string) {
	t.Helper()
	for _, secret := range []string{"Ueberfaellig", "Grenze", "@example.org", "Inhalt von", "Firma "} {
		if strings.Contains(logs, secret) {
			t.Errorf("Protokoll enthält personenbezogene Angabe %q:\n%s", secret, logs)
		}
	}
}

func TestREQ90AC4AC6BereinigungProtokolliertAnzahlOhnePersonendaten(t *testing.T) {
	f := newRetentionFixture(t)
	f.sendContact(t, at(2026, 11, 16, 10, 0, 0), "Ueberfaellig")
	f.sendContact(t, at(2026, 11, 18, 10, 0, 0), "Grenze")
	f.request(t, at(2026, 11, 1, 10, 0, 0), "alt@example.org")
	f.setClock(at(2027, 5, 17, 10, 0, 0))
	var buf syncBuffer
	r := NewRetention(f.contact, f.consultations, slog.New(slog.NewJSONHandler(&buf, nil)))

	if err := r.RunOnce(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := r.RunOnce(context.Background()); err != nil { // nichts mehr fällig
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 2 {
		t.Fatalf("erwartet je Lauf einen Eintrag, erhalten:\n%s", buf.String())
	}
	if !strings.Contains(lines[0], `"kontaktnachrichten":2`) || !strings.Contains(lines[0], `"beratungsanfragen":1`) {
		t.Errorf("erster Lauf ohne Anzahl je Datenart: %s", lines[0])
	}
	if !strings.Contains(lines[1], `"kontaktnachrichten":0`) || !strings.Contains(lines[1], `"beratungsanfragen":0`) {
		t.Errorf("Lauf ohne fällige Datensätze ohne Anzahl 0: %s", lines[1])
	}
	assertNoPersonalData(t, buf.String())
}

func TestREQ90AC4FehlerWirdProtokolliert(t *testing.T) {
	f := newRetentionFixture(t)
	var buf syncBuffer
	r := NewRetention(f.contact, f.consultations, slog.New(slog.NewJSONHandler(&buf, nil)))
	f.db.Close()
	if err := r.RunOnce(context.Background()); err == nil {
		t.Fatal("Lauf mit geschlossener Datenbank meldet keinen Fehler")
	}
	if !strings.Contains(buf.String(), `"level":"ERROR"`) {
		t.Errorf("Fehler nicht protokolliert: %s", buf.String())
	}
}

func TestREQ90AC6BereinigungLaeuftBeimStartUndWiederholt(t *testing.T) {
	f := newRetentionFixture(t)
	// Während eines Ausfalls fällig geworden: beide Datenarten.
	f.sendContact(t, at(2026, 1, 5, 10, 0, 0), "Ausfall")
	f.request(t, at(2026, 1, 5, 10, 0, 0), "ausfall@example.org")
	f.setClock(at(2027, 5, 17, 10, 0, 0))
	var buf syncBuffer
	r := NewRetention(f.contact, f.consultations, slog.New(slog.NewJSONHandler(&buf, nil)))
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { r.Run(ctx, 20*time.Millisecond); close(done) }()
	t.Cleanup(func() { cancel(); <-done })

	waitFor(t, "Löschung beim Start", func() bool {
		return len(contactNames(t, f.contact)) == 0 && len(consultationEmails(t, f.consultations)) == 0
	})
	// Ein später fällig gewordener Datensatz wird ohne Neustart beim nächsten Lauf gelöscht.
	f.sendContact(t, at(2026, 2, 1, 10, 0, 0), "Spaeter")
	f.setClock(at(2027, 5, 17, 10, 0, 0))
	waitFor(t, "Löschung im Folgelauf", func() bool { return len(contactNames(t, f.contact)) == 0 })
	assertNoPersonalData(t, buf.String())
}

func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("%s: nach 5 s nicht eingetreten", what)
		}
		time.Sleep(10 * time.Millisecond)
	}
}
