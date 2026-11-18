package service

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"
)

// Unit-Tests zur geplanten Veröffentlichung (REQ-21-AC5, REQ-84-AC3, REQ-84-AC4, REQ-84-AC5) mit gesteuerter Uhr
// gegen eine echte SQLite-Datenbank. Seit #94 prüft diese Ebene die Zeitregeln; der Fidelity-Test in
// app/e2e/tests/84-minuten.spec.ts prüft weiterhin die automatische Veröffentlichung im regulären Betrieb.

type testClock struct{ t time.Time }

func (c *testClock) now() time.Time { return c.t }

func newEditorialTest(t *testing.T, start time.Time) (*Editorial, *testClock) {
	t.Helper()
	_, db := newAccountsTest(t)
	clock := &testClock{t: start}
	e := NewEditorial(db)
	e.now = clock.now
	return e, clock
}

func createDraft(t *testing.T, e *Editorial, title string) EditorPost {
	t.Helper()
	p, err := e.Create(context.Background(), PostInput{Texts: []PostText{
		{Lang: DE, Title: title, Summary: "Kurztext", BodyMarkdown: "Beitragstext mit Inhalt."},
	}})
	if err != nil {
		t.Fatalf("Beitrag %q anlegen: %v", title, err)
	}
	return p
}

func publishDue(t *testing.T, e *Editorial) []int64 {
	t.Helper()
	published, skipped, err := e.PublishDue(context.Background())
	if err != nil || len(skipped) > 0 {
		t.Fatalf("PublishDue: veröffentlicht %v, übersprungen %v, Fehler %v", published, skipped, err)
	}
	return published
}

func mustPost(t *testing.T, e *Editorial, id int64) EditorPost {
	t.Helper()
	p, err := e.Post(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func TestREQ84AC5TerminInDerVergangenheitWirdAbgelehnt(t *testing.T) {
	start := time.Date(2030, 1, 17, 9, 36, 30, 0, time.UTC)
	e, _ := newEditorialTest(t, start)
	p := createDraft(t, e, "Vergangenheit")
	for _, at := range []time.Time{start.Add(-time.Minute), start} {
		_, err := e.Schedule(context.Background(), p.ID, at)
		var v *ValidationError
		if !errors.As(err, &v) {
			t.Errorf("Termin %s bei Uhrzeit %s: Fehler %v, erwartet Validierungsfehler", at, start, err)
		}
	}
	if got := mustPost(t, e, p.ID).ScheduledAt; got != nil {
		t.Errorf("abgelehnter Termin wurde gespeichert: %s", got)
	}
}

func TestREQ84AC3VeroeffentlichungAbDerGeplantenMinuteMitTerminAlsDatum(t *testing.T) {
	due := time.Date(2030, 1, 17, 9, 37, 0, 0, time.UTC)
	e, clock := newEditorialTest(t, due.Add(-30*time.Second))
	p := createDraft(t, e, "Geplant")
	if _, err := e.Schedule(context.Background(), p.ID, due); err != nil {
		t.Fatal(err)
	}

	clock.t = due.Add(-time.Second)
	if got := publishDue(t, e); len(got) != 0 {
		t.Fatalf("eine Sekunde vor dem Termin veröffentlicht: %v", got)
	}
	if s := mustPost(t, e, p.ID).Status; s != StatusDraft {
		t.Fatalf("Status vor dem Termin %q, erwartet %q", s, StatusDraft)
	}

	clock.t = due.Add(14 * time.Second) // nächster Lauf im 15-Sekunden-Takt
	if got := publishDue(t, e); !slices.Equal(got, []int64{p.ID}) {
		t.Fatalf("in der geplanten Minute veröffentlicht %v, erwartet [%d]", got, p.ID)
	}
	got := mustPost(t, e, p.ID)
	if got.Status != StatusPublished || got.PublishedAt == nil || !got.PublishedAt.Equal(due) {
		t.Fatalf("Status %q, Veröffentlichungsdatum %v; erwartet %q und %s", got.Status, got.PublishedAt, StatusPublished, due)
	}
	if got.ScheduledAt != nil {
		t.Errorf("Termin nach der Veröffentlichung weiter gesetzt: %s", got.ScheduledAt)
	}
}

func TestREQ84AC4GeaenderterTerminGiltUndAufgehobenerTerminBleibtUnveroeffentlicht(t *testing.T) {
	due := time.Date(2030, 1, 17, 9, 38, 0, 0, time.UTC)
	e, clock := newEditorialTest(t, due.Add(-10*time.Minute))
	moved := createDraft(t, e, "Verschoben")
	cancelled := createDraft(t, e, "Aufgehoben")
	ctx := context.Background()
	for _, step := range []struct {
		id int64
		at time.Time
	}{{moved.ID, due.Add(-time.Minute)}, {moved.ID, due}, {cancelled.ID, due.Add(-time.Minute)}} {
		if _, err := e.Schedule(ctx, step.id, step.at); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := e.Unschedule(ctx, cancelled.ID); err != nil {
		t.Fatal(err)
	}

	clock.t = due.Add(-time.Second) // alter Termin von moved und Termin von cancelled sind vorbei
	if got := publishDue(t, e); len(got) != 0 {
		t.Fatalf("vor dem geänderten Termin veröffentlicht: %v", got)
	}
	clock.t = due
	if got := publishDue(t, e); !slices.Equal(got, []int64{moved.ID}) {
		t.Fatalf("zum geänderten Termin veröffentlicht %v, erwartet [%d]", got, moved.ID)
	}
	if p := mustPost(t, e, moved.ID); p.PublishedAt == nil || !p.PublishedAt.Equal(due) {
		t.Errorf("Veröffentlichungsdatum %v, erwartet geänderter Termin %s", p.PublishedAt, due)
	}
	clock.t = due.Add(time.Hour)
	if got := publishDue(t, e); len(got) != 0 {
		t.Fatalf("aufgehobener Termin veröffentlicht: %v", got)
	}
	if p := mustPost(t, e, cancelled.ID); p.Status != StatusDraft || p.PublishedAt != nil {
		t.Errorf("aufgehobener Beitrag: Status %q, Datum %v; erwartet unveröffentlicht", p.Status, p.PublishedAt)
	}
}
