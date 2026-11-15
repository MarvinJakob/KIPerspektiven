package service

import (
	"context"
	"database/sql"
	"io"
	"log/slog"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"ki-web/backend/internal/store"
)

var testStatsKey = []byte("01234567890123456789012345678901")

func statsForTest(t *testing.T) (*Statistics, *sql.DB, *time.Time) {
	t.Helper()
	db, err := store.Open(filepath.Join(t.TempDir(), "stats.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := store.Migrate(context.Background(), db, false, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 1, 12, 0, 0, 0, StatsZone)
	stats := NewStatistics(db, nil, 3)
	stats.now = func() time.Time { return now }
	if err := stats.ConfigurePageViewCounting(context.Background(), testStatsKey); err != nil {
		t.Fatal(err)
	}
	return stats, db, &now
}

func countIP(t *testing.T, s *Statistics, ip string) {
	t.Helper()
	if err := s.CountPageView(context.Background(), ip); err != nil {
		t.Fatal(err)
	}
}
func getViews(t *testing.T, s *Statistics, p Period) PageViewStats {
	t.Helper()
	out, err := s.PageViews(context.Background(), p)
	if err != nil {
		t.Fatal(err)
	}
	return out
}
func wantTotal(t *testing.T, got PageViewStats, absolute, unique int64) {
	t.Helper()
	if got.Total != absolute || got.UniqueTotal == nil || *got.UniqueTotal != unique {
		t.Fatalf("Summe: absolut %d, bereinigt %v; erwartet %d/%d", got.Total, got.UniqueTotal, absolute, unique)
	}
}

func TestIPCountsAcrossBerlinMidnight(t *testing.T) {
	s, db, now := statsForTest(t)
	// UTC 22:59 entspricht 23:59 in Berlin; eine Minute spaeter beginnt der naechste Kalendertag.
	*now = time.Date(2026, 11, 13, 22, 59, 0, 0, time.UTC)
	for range 3 {
		countIP(t, s, "192.0.2.1")
	}
	*now = now.Add(time.Minute)
	countIP(t, s, "::ffff:192.0.2.1")
	countIP(t, s, "2001:0db8:0:0:0:0:0:1")
	for _, p := range []Period{Last7Days, Last30Days, AllTime} {
		got := getViews(t, s, p)
		wantTotal(t, got, 5, 2)
		if got.Days[0].Views != 2 || *got.Days[0].UniqueViews != 2 || got.Days[1].Views != 3 || *got.Days[1].UniqueViews != 1 {
			t.Fatalf("Tageswerte: %+v", got.Days[:2])
		}
		if p != AllTime && (got.Days[2].Views != 0 || got.Days[2].UniqueViews == nil || *got.Days[2].UniqueViews != 0) {
			t.Fatal("Tag ohne Abrufe muss 0/0 enthalten")
		}
	}
	countIP(t, s, "2001:db8::1")
	wantTotal(t, getViews(t, s, AllTime), 6, 2)
	var hash, day string
	if err := db.QueryRow("SELECT ip_hash,last_day FROM page_view_sources ORDER BY ip_hash LIMIT 1").Scan(&hash, &day); err != nil {
		t.Fatal(err)
	}
	if len(hash) != 64 || day != "2026-11-14" {
		t.Fatalf("unerwartete Ablage %q/%q", hash, day)
	}
}

func TestIPCountsPeriodBoundariesAndLastSeen(t *testing.T) {
	s, _, now := statsForTest(t)
	for _, entry := range []struct {
		day int
		ip  string
	}{{15, "192.0.2.1"}, {16, "192.0.2.2"}, {38, "192.0.2.3"}, {39, "192.0.2.4"}, {45, "192.0.2.5"}} {
		*now = time.Date(2026, 10, entry.day, 12, 0, 0, 0, StatsZone)
		countIP(t, s, entry.ip)
	}
	// Heute 14.11.: 7 Tage ab 8.11., 30 Tage ab 16.10. (einschliesslich).
	wantTotal(t, getViews(t, s, Last7Days), 2, 2)
	wantTotal(t, getViews(t, s, Last30Days), 4, 4)
	wantTotal(t, getViews(t, s, AllTime), 5, 5)
	countIP(t, s, "192.0.2.1") // lange nicht verwendete IP bleibt in Gesamt genau einmal enthalten.
	wantTotal(t, getViews(t, s, Last7Days), 3, 3)
	wantTotal(t, getViews(t, s, Last30Days), 5, 5)
	wantTotal(t, getViews(t, s, AllTime), 6, 5)
}

func TestIPCountsHistoricalAndMissingData(t *testing.T) {
	s, db, now := statsForTest(t)
	if _, err := db.Exec("INSERT INTO page_views(day,views) VALUES ('2026-10-01',8),('2026-11-14',3)"); err != nil {
		t.Fatal(err)
	}
	*now = time.Date(2026, 11, 14, 12, 0, 0, 0, StatsZone)
	countIP(t, s, "192.0.2.1")
	got := getViews(t, s, AllTime)
	if got.Total != 12 || got.UniqueTotal != nil || got.Days[0].UniqueViews != nil || got.Days[len(got.Days)-1].UniqueViews != nil {
		t.Fatalf("Historie darf nicht als vollstaendig erscheinen: %+v", got)
	}
	*now = time.Date(2026, 11, 21, 12, 0, 0, 0, StatsZone)
	countIP(t, s, "ungueltig")
	if got := getViews(t, s, Last7Days); got.Total != 1 || got.UniqueTotal != nil || got.Days[0].UniqueViews != nil {
		t.Fatalf("fehlende IP darf nicht als 0 erscheinen: %+v", got)
	}
	*now = now.AddDate(0, 0, 7)
	countIP(t, s, "192.0.2.1")
	wantTotal(t, getViews(t, s, Last7Days), 1, 1)
	if getViews(t, s, Last30Days).UniqueTotal != nil {
		t.Fatal("30 Tage enthalten weiter unvollstaendige Daten")
	}
}

func TestIPCountsSurviveRestartAndMarkKeyChange(t *testing.T) {
	s, db, now := statsForTest(t)
	countIP(t, s, "192.0.2.1")
	restart := NewStatistics(db, nil, 3)
	restart.now = s.now
	if err := restart.ConfigurePageViewCounting(context.Background(), testStatsKey); err != nil {
		t.Fatal(err)
	}
	countIP(t, restart, "192.0.2.1")
	wantTotal(t, getViews(t, restart, AllTime), 2, 1)
	*now = now.AddDate(0, 0, 1)
	otherKey := []byte("abcdefghijklmnopqrstuvwxyz123456")
	if err := restart.ConfigurePageViewCounting(context.Background(), otherKey); err != nil {
		t.Fatal(err)
	}
	countIP(t, restart, "192.0.2.1")
	got := getViews(t, restart, AllTime)
	if got.Total != 3 || got.UniqueTotal != nil || *got.Days[1].UniqueViews != 1 {
		t.Fatalf("Schluesselwechsel: %+v", got)
	}
	// Ein weiterer Wechsel am selben Tag muss auch den betroffenen Tageswert als unbekannt markieren.
	if err := restart.ConfigurePageViewCounting(context.Background(), testStatsKey); err != nil {
		t.Fatal(err)
	}
	countIP(t, restart, "192.0.2.1")
	if getViews(t, restart, AllTime).Days[0].UniqueViews != nil {
		t.Fatal("gemischte Schluessel am selben Tag")
	}
	*now = now.AddDate(0, 0, 7)
	countIP(t, restart, "192.0.2.1")
	wantTotal(t, getViews(t, restart, Last7Days), 1, 1)
}

func TestIPCountsAreAtomicUnderConcurrentRequests(t *testing.T) {
	s, _, _ := statsForTest(t)
	var wg sync.WaitGroup
	for i := range 24 {
		wg.Go(func() {
			ip := "192.0.2.1"
			if i%2 == 0 {
				ip = "192.0.2.2"
			}
			if err := s.CountPageView(context.Background(), ip); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	got := getViews(t, s, Last7Days)
	wantTotal(t, got, 24, 2)
	if *got.Days[0].UniqueViews != 2 {
		t.Fatal("parallele Tagesbereinigung")
	}
}

func TestDelayedPageViewKeepsAbsoluteCount(t *testing.T) {
	s, _, now := statsForTest(t)
	countIP(t, s, "192.0.2.1")
	*now = now.AddDate(0, 0, 1)
	countIP(t, s, "192.0.2.1")
	*now = now.AddDate(0, 0, -1)
	countIP(t, s, "192.0.2.1")
	got := getViews(t, s, Last7Days)
	if got.Total != 2 || got.Days[0].UniqueViews != nil || got.UniqueTotal != nil {
		t.Fatalf("verspaeteter Abruf: %+v", got)
	}
}

func TestIPCountingResetWithoutMetadataKeepsHistoryUnknown(t *testing.T) {
	s, db, _ := statsForTest(t)
	countIP(t, s, "192.0.2.1")
	if _, err := db.Exec("DELETE FROM page_view_sources; DELETE FROM page_view_identity;"); err != nil {
		t.Fatal(err)
	}
	if err := s.ConfigurePageViewCounting(context.Background(), testStatsKey); err != nil {
		t.Fatal(err)
	}
	countIP(t, s, "192.0.2.1")
	got := getViews(t, s, AllTime)
	if got.Total != 2 || got.UniqueTotal != nil || got.Days[0].UniqueViews != nil {
		t.Fatalf("Reset darf alte und neue Tageswerte nicht vermischen: %+v", got)
	}
}
