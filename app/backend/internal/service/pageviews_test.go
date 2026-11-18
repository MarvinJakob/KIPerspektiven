package service

import (
	"context"
	"io"
	"log/slog"
	"path/filepath"
	"testing"
	"time"

	"ki-web/backend/internal/store"
)

// Unit-Tests zu REQ-26-AC4 (Ticket #26): IP-bereinigte Seitenaufrufe über mehrere Kalendertage.
// Die Uhr des Dienstes wird gesteuert; die Sollwerte sind aus dem Kriterium abgeleitet, nicht aus dem Code.

func newPageViewTestService(t *testing.T) (*Statistics, *time.Time) {
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
	s := NewStatistics(db, nil, 0)
	clock := new(time.Time)
	s.now = func() time.Time { return *clock }
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	*clock = time.Date(2026, 11, 1, 8, 0, 0, 0, StatsZone)
	if err := s.ConfigurePageViewCounting(ctx, key); err != nil {
		t.Fatal(err)
	}
	return s, clock
}

func visit(t *testing.T, s *Statistics, clock *time.Time, at time.Time, ip string) {
	t.Helper()
	*clock = at
	if err := s.CountPageView(context.Background(), ip); err != nil {
		t.Fatalf("Abruf %s um %s: %v", ip, at, err)
	}
}

func dayMap(t *testing.T, st PageViewStats) map[string]DayViews {
	t.Helper()
	m := make(map[string]DayViews, len(st.Days))
	for _, d := range st.Days {
		m[d.Day] = d
	}
	return m
}

func wantDay(t *testing.T, days map[string]DayViews, day string, views, unique int64) {
	t.Helper()
	d, ok := days[day]
	if !ok {
		t.Fatalf("REQ-26-AC4: Tag %s fehlt in den Tageswerten", day)
	}
	if d.Views != views {
		t.Errorf("REQ-26-AC4: Tag %s absolut = %d, erwartet %d", day, d.Views, views)
	}
	if d.UniqueViews == nil || *d.UniqueViews != unique {
		t.Errorf("REQ-26-AC4: Tag %s bereinigt = %v, erwartet %d (je IP einmal pro Kalendertag)", day, d.UniqueViews, unique)
	}
}

// REQ-26-AC4: Dieselbe IP an zwei Kalendertagen zählt im Zeitraum einmal und je Tag einmal;
// die bereinigte Gesamtsumme ist deshalb kleiner als die Summe der bereinigten Tageswerte.
func TestREQ26AC4_SameIPOnSeveralDaysCountsOncePerPeriodAndOncePerDay(t *testing.T) {
	s, clock := newPageViewTestService(t)
	ctx := context.Background()
	const a, b = "203.0.113.10", "198.51.100.20"

	// Tag 1 (10.11.): A ruft zweimal ab.
	visit(t, s, clock, time.Date(2026, 11, 10, 9, 0, 0, 0, StatsZone), a)
	visit(t, s, clock, time.Date(2026, 11, 10, 15, 0, 0, 0, StatsZone), a)
	// Tag 2 (11.11.): A erneut, B erstmals.
	visit(t, s, clock, time.Date(2026, 11, 11, 10, 0, 0, 0, StatsZone), a)
	visit(t, s, clock, time.Date(2026, 11, 11, 11, 0, 0, 0, StatsZone), b)

	*clock = time.Date(2026, 11, 12, 12, 0, 0, 0, StatsZone)
	st, err := s.PageViews(ctx, Last7Days)
	if err != nil {
		t.Fatal(err)
	}
	days := dayMap(t, st)
	wantDay(t, days, "2026-11-10", 2, 1)
	wantDay(t, days, "2026-11-11", 2, 2)
	wantDay(t, days, "2026-11-12", 0, 0)
	if st.Total != 4 {
		t.Errorf("REQ-26-AC3: absolute Summe = %d, erwartet 4", st.Total)
	}
	if st.UniqueTotal == nil {
		t.Fatal("REQ-26-AC4: bereinigte Gesamtsumme fehlt, obwohl alle Abrufe zugeordnet sind")
	}
	var sumOfDays int64
	for _, d := range st.Days {
		sumOfDays += *d.UniqueViews
	}
	if *st.UniqueTotal != 2 {
		t.Errorf("REQ-26-AC4: bereinigte Gesamtsumme = %d, erwartet 2 (A und B je einmal im Zeitraum)", *st.UniqueTotal)
	}
	if *st.UniqueTotal == sumOfDays {
		t.Errorf("REQ-26-AC4: bereinigte Gesamtsumme %d darf nicht die Summe der Tageswerte (%d) sein", *st.UniqueTotal, sumOfDays)
	}
}

// REQ-26-AC4 mit Zeitraumgrenze: Eine IP, die nur vor dem Zeitraum abgerufen hat, zählt dort nicht;
// eine IP, die vorher und im Zeitraum abgerufen hat, zählt im Zeitraum einmal. „Gesamt“ zählt beide einmal.
func TestREQ26AC4_PeriodBoundaryCountsEachIPOnceInChosenPeriod(t *testing.T) {
	s, clock := newPageViewTestService(t)
	ctx := context.Background()
	const a, c = "203.0.113.10", "192.0.2.30"

	visit(t, s, clock, time.Date(2026, 11, 2, 9, 0, 0, 0, StatsZone), a)
	visit(t, s, clock, time.Date(2026, 11, 2, 9, 5, 0, 0, StatsZone), c)
	visit(t, s, clock, time.Date(2026, 11, 11, 9, 0, 0, 0, StatsZone), a)

	*clock = time.Date(2026, 11, 12, 12, 0, 0, 0, StatsZone) // 7 Tage: 06.11. bis 12.11.
	week, err := s.PageViews(ctx, Last7Days)
	if err != nil {
		t.Fatal(err)
	}
	if week.Total != 1 || week.UniqueTotal == nil || *week.UniqueTotal != 1 {
		t.Errorf("REQ-26-AC4: letzte 7 Tage absolut %d / bereinigt %v, erwartet 1 / 1", week.Total, week.UniqueTotal)
	}
	all, err := s.PageViews(ctx, AllTime)
	if err != nil {
		t.Fatal(err)
	}
	if all.Total != 3 || all.UniqueTotal == nil || *all.UniqueTotal != 2 {
		t.Errorf("REQ-26-AC4: Gesamt absolut %d / bereinigt %v, erwartet 3 / 2", all.Total, all.UniqueTotal)
	}
	days := dayMap(t, all)
	wantDay(t, days, "2026-11-02", 2, 2)
	wantDay(t, days, "2026-11-11", 1, 1)
}

// REQ-26-AC4 und REQ-26-AC7: Kalendertage gelten nach Europe/Berlin, nicht nach UTC.
// 22:30 UTC und 23:30 UTC am 10.11. sind 23:30 Uhr am 10.11. und 0:30 Uhr am 11.11. deutscher Zeit.
func TestREQ26AC4_CalendarDayFollowsEuropeBerlin(t *testing.T) {
	s, clock := newPageViewTestService(t)
	const a = "2001:db8::1"

	visit(t, s, clock, time.Date(2026, 11, 10, 22, 30, 0, 0, time.UTC), a)
	visit(t, s, clock, time.Date(2026, 11, 10, 23, 30, 0, 0, time.UTC), a)

	*clock = time.Date(2026, 11, 11, 12, 0, 0, 0, StatsZone)
	st, err := s.PageViews(context.Background(), Last7Days)
	if err != nil {
		t.Fatal(err)
	}
	days := dayMap(t, st)
	wantDay(t, days, "2026-11-10", 1, 1)
	wantDay(t, days, "2026-11-11", 1, 1)
	if st.UniqueTotal == nil || *st.UniqueTotal != 1 {
		t.Errorf("REQ-26-AC4: bereinigte Gesamtsumme = %v, erwartet 1", st.UniqueTotal)
	}
}
