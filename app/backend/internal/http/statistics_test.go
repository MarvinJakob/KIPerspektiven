package httpserver_test

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"net/netip"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"ki-web/backend/internal/api"
	"ki-web/backend/internal/audit"
	"ki-web/backend/internal/auth"
	httpserver "ki-web/backend/internal/http"
	"ki-web/backend/internal/service"
)

// Ticket #130: Statistik zu Seitenaufrufen und Ergebnissen der Selbsteinschätzung.

func releasedSlugs(t *testing.T) []string {
	t.Helper()
	c, err := audit.Load()
	if err != nil {
		t.Fatal(err)
	}
	return c.Slugs()
}

// resultInput baut ein vollständiges Ergebnis mit demselben Reifegrad für alle freigegebenen Dimensionen.
func resultInput(t *testing.T, key string, lang api.Lang, level int) api.ReadinessResultInput {
	t.Helper()
	in := api.ReadinessResultInput{Key: key, Lang: lang}
	for _, s := range releasedSlugs(t) {
		in.Ratings = append(in.Ratings, api.ReadinessRating{Dimension: s, Level: level})
	}
	return in
}

func count(t *testing.T, db *sql.DB, table string) int {
	t.Helper()
	var n int
	if err := db.QueryRow("SELECT COUNT(*) FROM " + table).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func columns(t *testing.T, db *sql.DB, table string) []string {
	t.Helper()
	rows, err := db.Query("SELECT name FROM pragma_table_info(?) ORDER BY cid", table)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			t.Fatal(err)
		}
		out = append(out, n)
	}
	return out
}

func today() time.Time { return time.Now().In(service.StatsZone) }

func dayOffset(days int) string { return today().AddDate(0, 0, -days).Format("2006-01-02") }

const resultKey = "0123456789abcdef0123456789abcdef"

// Keine Klartext-IP oder Browserdaten: IP-Pseudonyme enthalten nur den letzten Tag (#142).
// Ergebnisse bleiben ohne Personenzuordnung und die Ergebniskennung liegt nur als Hash vor.
func TestStatisticsSchemaHoldsNoVisitorData(t *testing.T) {
	_, db := newServer(t, false)
	for table, want := range map[string][]string{
		"page_views":               {"day", "views", "identified_views", "unique_views"},
		"page_view_sources":        {"ip_hash", "last_day"},
		"page_view_identity":       {"id", "key_id", "started_at"},
		"readiness_results":        {"id", "key_hash", "lang", "submitted_at"},
		"readiness_result_ratings": {"result_id", "dimension", "level"},
	} {
		if got := columns(t, db, table); !slices.Equal(got, want) {
			t.Errorf("%s: Spalten %v, erwartet %v", table, got, want)
		}
	}
}

func TestPageViewsCountPublicPagesOnly(t *testing.T) {
	srv, db := newServerWithAccounts(t)
	counted := []string{"/", "/de", "/de/blog", "/en/profil", "/de/themen/ai-audit", "/de/themen/ai-audit/auswertung"}
	for _, p := range counted {
		resp, body := get(t, srv, p)
		wantStatus(t, resp, body, http.StatusOK)
		if c := resp.Header.Values("Set-Cookie"); len(c) > 0 {
			t.Errorf("%s setzt Cookies: %v", p, c)
		}
	}
	// Nicht gezählt: Redaktion, API, Dateien, Fehlerseiten, HEAD und Vorab-Abrufe.
	for _, p := range []string{"/redaktion/anmelden", "/redaktion", "/redaktion/statistik", "/api/topics", "/assets/app-abc.js",
		"/favicon.svg", "/robots.txt", "/sitemap.xml", "/de/gibt-es-nicht", "/fr"} {
		get(t, srv, p)
	}
	b := newBrowser(t, srv)
	if resp, body := b.do(http.MethodHead, "/de", nil); resp.StatusCode != http.StatusOK {
		t.Fatalf("HEAD /de: %d %s", resp.StatusCode, body)
	}
	b.do(http.MethodGet, "/de", nil, "Sec-Purpose", "prefetch")
	b.do(http.MethodGet, "/de", nil, "Purpose", "prefetch")

	var day string
	var views int
	if err := db.QueryRow("SELECT day, views FROM page_views").Scan(&day, &views); err != nil {
		t.Fatal(err)
	}
	if day != dayOffset(0) || views != len(counted) {
		t.Fatalf("Tageszähler %s = %d, erwartet %s = %d", day, views, dayOffset(0), len(counted))
	}

	// Eine angemeldete Redakteurin sieht dieselbe Zahl; ihre Redaktionsseiten zählen nicht mit.
	b.mustLogin(editorEmail)
	resp, _ := b.do(http.MethodGet, "/redaktion/statistik", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("/redaktion/statistik: %d", resp.StatusCode)
	}
	resp, body := b.do(http.MethodGet, "/api/admin/statistics/page-views", nil)
	wantStatus(t, resp, body, http.StatusOK)
	st := decode[api.PageViewStats](t, body)
	if st.Period != api.N30d || st.Total != int64(len(counted)) || len(st.Days) != 30 {
		t.Fatalf("Vorauswahl: %+v", st)
	}
	if st.Days[0].Date != dayOffset(0) || st.Days[0].Views != int64(len(counted)) || st.Days[29].Date != dayOffset(29) {
		t.Fatalf("Tage: erster %+v, letzter %+v", st.Days[0], st.Days[29])
	}
}

func TestPageViewPeriods(t *testing.T) {
	srv, db := newServerWithAccounts(t)
	get(t, srv, "/de") // heute: 1
	for days, views := range map[int]int{6: 2, 7: 4, 29: 8, 30: 16} {
		if _, err := db.Exec("INSERT INTO page_views (day, views) VALUES (?, ?)", dayOffset(days), views); err != nil {
			t.Fatal(err)
		}
	}
	b := newBrowser(t, srv)
	b.mustLogin(editorEmail)
	for _, c := range []struct {
		query string
		total int64
		days  int
	}{
		{"?period=7d", 1 + 2, 7},
		{"?period=30d", 1 + 2 + 4 + 8, 30},
		{"?period=all", 1 + 2 + 4 + 8 + 16, 31}, // gesamt: lückenlos seit dem ersten Aufruf
	} {
		resp, body := b.do(http.MethodGet, "/api/admin/statistics/page-views"+c.query, nil)
		wantStatus(t, resp, body, http.StatusOK)
		st := decode[api.PageViewStats](t, body)
		if st.Total != c.total || len(st.Days) != c.days {
			t.Errorf("%s: Summe %d mit %d Tagen, erwartet %d mit %d", c.query, st.Total, len(st.Days), c.total, c.days)
		}
		if st.Days[1].Date != dayOffset(1) || st.Days[1].Views != 0 || st.Days[1].UniqueViews == nil || *st.Days[1].UniqueViews != 0 {
			t.Errorf("%s: Tag ohne Aufrufe fehlt: %+v", c.query, st.Days[1])
		}
		if !slices.IsSortedFunc(st.Days, func(a, b api.PageViewDay) int { return strings.Compare(b.Date, a.Date) }) {
			t.Errorf("%s: Tage nicht absteigend: %+v", c.query, st.Days)
		}
	}
	resp, body := b.do(http.MethodGet, "/api/admin/statistics/page-views?period=365d", nil)
	wantStatus(t, resp, body, http.StatusBadRequest)
}

// Gesamt bleibt ohne erfasste Aufrufe leer und ergänzt auch Tage nach dem letzten Aufruf.
func TestAllPageViewsWithoutRecentViews(t *testing.T) {
	srv, db := newServerWithAccounts(t)
	b := newBrowser(t, srv)
	b.mustLogin(editorEmail)
	resp, body := b.do(http.MethodGet, "/api/admin/statistics/page-views?period=all", nil)
	wantStatus(t, resp, body, http.StatusOK)
	st := decode[api.PageViewStats](t, body)
	if st.Total != 0 || len(st.Days) != 0 {
		t.Fatalf("Ohne Aufrufe: %+v", st)
	}
	if _, err := db.Exec("INSERT INTO page_views (day, views) VALUES (?, ?)", dayOffset(2), 5); err != nil {
		t.Fatal(err)
	}
	resp, body = b.do(http.MethodGet, "/api/admin/statistics/page-views?period=all", nil)
	wantStatus(t, resp, body, http.StatusOK)
	st = decode[api.PageViewStats](t, body)
	zero := int64(0)
	want := []api.PageViewDay{{Date: dayOffset(0), Views: 0, UniqueViews: &zero}, {Date: dayOffset(1), Views: 0, UniqueViews: &zero}, {Date: dayOffset(2), Views: 5}}
	if st.Total != 5 || !reflect.DeepEqual(st.Days, want) {
		t.Fatalf("Gesamt: %+v, erwartet %+v", st, want)
	}
}

func TestReadinessResultIsSavedUpdatedAndNotDuplicated(t *testing.T) {
	srv, db := newServer(t, false)
	b := newBrowser(t, srv)
	in := resultInput(t, resultKey, api.De, 2)

	resp, body := b.do(http.MethodPost, "/api/readiness-results", in)
	wantStatus(t, resp, body, http.StatusNoContent)
	if c := resp.Header.Values("Set-Cookie"); len(c) > 0 {
		t.Errorf("Speichern setzt Cookies: %v", c)
	}
	if n, want := count(t, db, "readiness_result_ratings"), len(in.Ratings); count(t, db, "readiness_results") != 1 || n != want {
		t.Fatalf("%d Ergebnisse mit %d Bewertungen, erwartet 1 mit %d", count(t, db, "readiness_results"), n, want)
	}
	var hash, lang string
	if err := db.QueryRow("SELECT key_hash, lang FROM readiness_results").Scan(&hash, &lang); err != nil {
		t.Fatal(err)
	}
	if hash != auth.HashToken(resultKey) || lang != "de" {
		t.Fatalf("gespeichert: %s/%s; die Kennung selbst darf nicht in der Datenbank stehen", hash, lang)
	}

	// Erneut ohne Änderung: kein weiterer Eintrag, auch der Zeitpunkt bleibt.
	const old = "2026-01-01T00:00:00Z"
	if _, err := db.Exec("UPDATE readiness_results SET submitted_at = ?", old); err != nil {
		t.Fatal(err)
	}
	resp, body = b.do(http.MethodPost, "/api/readiness-results", in)
	wantStatus(t, resp, body, http.StatusNoContent)
	var at string
	_ = db.QueryRow("SELECT submitted_at FROM readiness_results").Scan(&at)
	if count(t, db, "readiness_results") != 1 || at != old {
		t.Fatalf("unverändertes Ergebnis: %d Einträge, Zeitpunkt %s", count(t, db, "readiness_results"), at)
	}

	// Geänderte Bewertung und Sprache: dasselbe Ergebnis wird aktualisiert.
	in.Ratings[0].Level = 3
	in.Lang = api.En
	resp, body = b.do(http.MethodPost, "/api/readiness-results", in)
	wantStatus(t, resp, body, http.StatusNoContent)
	var level int
	_ = db.QueryRow("SELECT r.lang, r.submitted_at, x.level FROM readiness_results r JOIN readiness_result_ratings x ON x.result_id = r.id WHERE x.dimension = ?",
		in.Ratings[0].Dimension).Scan(&lang, &at, &level)
	if count(t, db, "readiness_results") != 1 || count(t, db, "readiness_result_ratings") != len(in.Ratings) || level != 3 || lang != "en" || at == old {
		t.Fatalf("aktualisiert: %d Einträge, Reifegrad %d, Sprache %s, Zeitpunkt %s", count(t, db, "readiness_results"), level, lang, at)
	}

	// Ein anderes Browserfenster hat eine andere Kennung und ergibt ein weiteres Ergebnis.
	resp, body = b.do(http.MethodPost, "/api/readiness-results", resultInput(t, strings.Repeat("f", 32), api.De, 1))
	wantStatus(t, resp, body, http.StatusNoContent)
	if n := count(t, db, "readiness_results"); n != 2 {
		t.Fatalf("%d Ergebnisse, erwartet 2", n)
	}
}

func TestReadinessResultRejectsIncompleteOrInvalidResults(t *testing.T) {
	srv, db := newServer(t, false)
	b := newBrowser(t, srv)
	valid := func() api.ReadinessResultInput { return resultInput(t, resultKey, api.De, 2) }
	cases := map[string]func(*api.ReadinessResultInput){
		"Dimension fehlt":   func(in *api.ReadinessResultInput) { in.Ratings = in.Ratings[1:] },
		"keine Bewertung":   func(in *api.ReadinessResultInput) { in.Ratings = nil },
		"Dimension doppelt": func(in *api.ReadinessResultInput) { in.Ratings[len(in.Ratings)-1] = in.Ratings[0] },
		"zusätzliche Dimension": func(in *api.ReadinessResultInput) {
			in.Ratings = append(in.Ratings, api.ReadinessRating{Dimension: "erfunden", Level: 1})
		},
		"unbekannte Dimension":    func(in *api.ReadinessResultInput) { in.Ratings[0].Dimension = "erfunden" },
		"Reifegrad 0":             func(in *api.ReadinessResultInput) { in.Ratings[0].Level = 0 },
		"Reifegrad 4":             func(in *api.ReadinessResultInput) { in.Ratings[0].Level = 4 },
		"Kennung zu kurz":         func(in *api.ReadinessResultInput) { in.Key = "abc" },
		"Kennung mit Großbuchst.": func(in *api.ReadinessResultInput) { in.Key = strings.ToUpper(resultKey) },
		"Kennung leer":            func(in *api.ReadinessResultInput) { in.Key = "" },
		"unbekannte Sprache":      func(in *api.ReadinessResultInput) { in.Lang = "fr" },
	}
	for name, change := range cases {
		in := valid()
		change(&in)
		resp, body := b.do(http.MethodPost, "/api/readiness-results", in)
		if resp.StatusCode != http.StatusUnprocessableEntity {
			t.Errorf("%s: Status %d, erwartet 422 (%s)", name, resp.StatusCode, body)
		}
	}
	for name, raw := range map[string]string{"kein JSON": "{", "kein Text": ""} {
		req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/readiness-results", strings.NewReader(raw))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("%s: Status %d, erwartet 400", name, resp.StatusCode)
		}
	}
	if n := count(t, db, "readiness_results"); n != 0 {
		t.Fatalf("%d ungültige Ergebnisse gespeichert", n)
	}
}

func TestReadinessResultCanBeWithdrawn(t *testing.T) {
	srv, db := newServer(t, false)
	b := newBrowser(t, srv)
	resp, body := b.do(http.MethodPost, "/api/readiness-results", resultInput(t, resultKey, api.De, 1))
	wantStatus(t, resp, body, http.StatusNoContent)

	resp, body = b.do(http.MethodDelete, "/api/readiness-results/"+resultKey, nil)
	wantStatus(t, resp, body, http.StatusNoContent)
	if count(t, db, "readiness_results") != 0 || count(t, db, "readiness_result_ratings") != 0 {
		t.Fatal("Ergebnis oder Bewertungen nach dem Löschen noch vorhanden")
	}
	resp, body = b.do(http.MethodDelete, "/api/readiness-results/"+resultKey, nil)
	wantStatus(t, resp, body, http.StatusNoContent) // erneut: nichts mehr da, trotzdem 204
	resp, body = b.do(http.MethodDelete, "/api/readiness-results/nicht-hex", nil)
	wantStatus(t, resp, body, http.StatusUnprocessableEntity)
}

// Öffentliche Schreibzugriffe prüfen die Herkunft wie alle schreibenden Aufrufe und begrenzen die Größe.
func TestReadinessResultWritesCheckOriginAndSize(t *testing.T) {
	srv, db := newServer(t, false)
	b := newBrowser(t, srv)
	in := resultInput(t, resultKey, api.De, 1)
	resp, body := b.do(http.MethodPost, "/api/readiness-results", in, "Origin", "https://fremd.example")
	wantStatus(t, resp, body, http.StatusForbidden)
	resp, body = b.do(http.MethodDelete, "/api/readiness-results/"+resultKey, nil, "Sec-Fetch-Site", "cross-site")
	wantStatus(t, resp, body, http.StatusForbidden)

	in.Ratings[0].Dimension = strings.Repeat("x", 8<<10)
	resp, body = b.do(http.MethodPost, "/api/readiness-results", in)
	wantStatus(t, resp, body, http.StatusRequestEntityTooLarge)
	if n := count(t, db, "readiness_results"); n != 0 {
		t.Fatalf("%d Ergebnisse gespeichert", n)
	}
}

func TestStatisticsRequireEditorialSession(t *testing.T) {
	srv, _ := newServerWithAccounts(t)
	paths := []string{"/api/admin/statistics/page-views", "/api/admin/statistics/readiness-results"}
	anon := newBrowser(t, srv)
	for _, p := range paths {
		resp, body := anon.do(http.MethodGet, p, nil)
		wantStatus(t, resp, body, http.StatusUnauthorized)
		if strings.Contains(body, "total") {
			t.Errorf("%s liefert ohne Anmeldung Daten: %s", p, body)
		}
	}
	resp, _ := anon.do(http.MethodGet, "/redaktion/statistik", nil)
	wantRedirect(t, resp, "/redaktion/anmelden")

	for _, email := range []string{editorEmail, adminEmail} {
		b := newBrowser(t, srv)
		b.mustLogin(email)
		for _, p := range append(paths, "/redaktion/statistik") {
			resp, body := b.do(http.MethodGet, p, nil)
			wantStatus(t, resp, body, http.StatusOK)
		}
	}
}

func TestReadinessResultsListNewestFirstWithPaging(t *testing.T) {
	srv, db := newServerWithAccounts(t)
	slugs := releasedSlugs(t)
	stats := service.NewStatistics(db, slugs, audit.LevelCount)
	ctx := context.Background()
	const n = service.ResultsPageSize + 1
	for i := 1; i <= n; i++ {
		var rs []service.Rating
		for j, s := range slugs {
			rs = append(rs, service.Rating{Dimension: s, Level: (i+j)%3 + 1})
		}
		lang := service.DE
		if i%2 == 0 {
			lang = service.EN
		}
		if err := stats.SaveReadinessResult(ctx, fmt.Sprintf("%032x", i), lang, rs); err != nil {
			t.Fatal(err)
		}
	}
	// Das erste Ergebnis liegt 40 Tage zurück und fällt aus den letzten 30 Tagen heraus.
	if _, err := db.Exec("UPDATE readiness_results SET submitted_at = ? WHERE id = 1", time.Now().AddDate(0, 0, -40).UTC().Format(time.RFC3339)); err != nil {
		t.Fatal(err)
	}

	b := newBrowser(t, srv)
	b.mustLogin(editorEmail)
	list := func(query string) api.ReadinessResultPage {
		t.Helper()
		resp, body := b.do(http.MethodGet, "/api/admin/statistics/readiness-results"+query, nil)
		wantStatus(t, resp, body, http.StatusOK)
		return decode[api.ReadinessResultPage](t, body)
	}

	p := list("")
	if p.Period != api.N30d || p.Total != n-1 || p.Page != 1 || p.PageSize != service.ResultsPageSize || len(p.Items) != n-1 {
		t.Fatalf("30 Tage: Summe %d, Seite %d, %d Einträge", p.Total, p.Page, len(p.Items))
	}
	newest := p.Items[0]
	if newest.Id != n || newest.Lang != api.De || newest.SubmittedAt.IsZero() || len(newest.Ratings) != len(slugs) {
		t.Fatalf("neuester Eintrag: %+v", newest)
	}
	for j, r := range newest.Ratings {
		if r.Dimension != slugs[j] || r.Level != (n+j)%3+1 {
			t.Fatalf("Bewertung %d: %+v", j, r)
		}
	}
	if len(p.Dimensions) != len(slugs) || p.Dimensions[0].Slug != slugs[0] || p.Dimensions[0].Title == "" {
		t.Fatalf("Dimensionen: %+v", p.Dimensions)
	}
	if names := []string{p.Levels[0].Name, p.Levels[1].Name, p.Levels[2].Name}; !slices.Equal(names, []string{"Einfach", "Strukturiert", "Intelligent"}) {
		t.Fatalf("Reifegrade: %v", names)
	}

	all := list("?period=all")
	second := list("?period=all&page=2")
	if all.Total != n || len(all.Items) != service.ResultsPageSize || len(second.Items) != 1 || second.Items[0].Id != 1 {
		t.Fatalf("gesamt: Summe %d, Seite 1 mit %d, Seite 2 mit %d Einträgen", all.Total, len(all.Items), len(second.Items))
	}
	if week := list("?period=7d"); week.Total != n-1 {
		t.Fatalf("7 Tage: Summe %d", week.Total)
	}
	resp, body := b.do(http.MethodGet, "/api/admin/statistics/readiness-results?period=gestern", nil)
	wantStatus(t, resp, body, http.StatusBadRequest)
}

// Der oeffentliche HTML-Abruf bekommt dieselbe gepruefte Client-IP wie die Ratenbegrenzung.
func TestPageViewIPCountingBehindConfiguredProxy(t *testing.T) {
	srv, db := newServer(t, false, func(cfg *httpserver.Config) {
		cfg.TrustedProxies = []netip.Prefix{netip.MustParsePrefix("127.0.0.0/8"), netip.MustParsePrefix("::1/128")}
	})
	createUser(t, db, editorEmail, "editor")
	b := newBrowser(t, srv)
	for _, ip := range []string{"192.0.2.1", "::ffff:192.0.2.1", "198.51.100.9, 192.0.2.1", "2001:db8::1"} {
		resp, body := b.do(http.MethodGet, "/de", nil, "X-Forwarded-For", ip)
		wantStatus(t, resp, body, http.StatusOK)
	}
	b.mustLogin(editorEmail)
	resp, body := b.do(http.MethodGet, "/api/admin/statistics/page-views?period=all", nil)
	wantStatus(t, resp, body, http.StatusOK)
	st := decode[api.PageViewStats](t, body)
	if st.Total != 4 || st.UniqueTotal == nil || *st.UniqueTotal != 2 || st.Days[0].UniqueViews == nil || *st.Days[0].UniqueViews != 2 {
		t.Fatalf("Proxy-Bereinigung: %+v", st)
	}
	if strings.Contains(body, "192.0.2.1") || strings.Contains(body, "ip_hash") {
		t.Fatal("API gibt IP-Zuordnung aus")
	}
}
