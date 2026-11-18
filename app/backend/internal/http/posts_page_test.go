package httpserver

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"log/slog"
	"path/filepath"
	"testing"
	"time"

	"ki-web/backend/internal/api"
	"ki-web/backend/internal/service"
	"ki-web/backend/internal/store"
)

// Fidelity-Tests zu REQ-75-AC1, AC2, AC4 und AC7 (Ticket #75) über die API-Schicht GET /api/posts gegen eine
// echte SQLite-Datenbank. Sollwerte (20 je Portion, Reihenfolge Datum↓ dann ID↓) stammen aus dem Ticket.

type feedDB struct {
	t   *testing.T
	db  *sql.DB
	srv *apiServer
}

func newFeedDB(t *testing.T) *feedDB {
	t.Helper()
	db, err := store.Open(filepath.Join(t.TempDir(), "feed.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := store.Migrate(context.Background(), db, false, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatal(err)
	}
	return &feedDB{t: t, db: db, srv: &apiServer{svc: service.NewPublic(store.New(db))}}
}

// post legt einen Beitrag mit fester ID an. at leer bedeutet Entwurf.
func (f *feedDB) post(id int64, status, at string, langs ...string) {
	f.t.Helper()
	var published any
	if at != "" {
		published = at
	}
	if _, err := f.db.Exec(`INSERT INTO posts (id, slug, status, published_at, featured, updated_at) VALUES (?, ?, ?, ?, FALSE, ?)`,
		id, fmt.Sprintf("beitrag-%d", id), status, published, "2026-01-01T00:00:00Z"); err != nil {
		f.t.Fatal(err)
	}
	if len(langs) == 0 {
		langs = []string{"de", "en"}
	}
	for _, l := range langs {
		if _, err := f.db.Exec(`INSERT INTO post_translations (post_id, lang, title, summary, body_markdown) VALUES (?, ?, ?, ?, ?)`,
			id, l, fmt.Sprintf("Titel %d %s", id, l), "Kurztext", "Text"); err != nil {
			f.t.Fatal(err)
		}
	}
}

// published legt n veröffentlichte Beiträge mit IDs 1..n an; Beitrag i erschien i Tage nach dem 1.1.2026.
func (f *feedDB) published(n int) {
	base := time.Date(2026, 1, 1, 9, 0, 0, 0, time.UTC)
	for i := 1; i <= n; i++ {
		f.post(int64(i), "published", base.AddDate(0, 0, i).Format(time.RFC3339))
	}
}

func (f *feedDB) page(lang string, cursor *string) api.PostList {
	f.t.Helper()
	l := api.Lang(lang)
	res, err := f.srv.ListPosts(context.Background(), api.ListPostsRequestObject{Params: api.ListPostsParams{Lang: &l, Cursor: cursor}})
	if err != nil {
		f.t.Fatal(err)
	}
	ok, isOK := res.(api.ListPosts200JSONResponse)
	if !isOK {
		f.t.Fatalf("Antwort %T, erwartet 200", res)
	}
	return api.PostList(ok)
}

// all ruft alle Portionen ab und liefert die Slugs je Portion.
func (f *feedDB) all(lang string) [][]string {
	f.t.Helper()
	var out [][]string
	var cursor *string
	for i := 0; i < 20; i++ {
		p := f.page(lang, cursor)
		out = append(out, slugs(p.Items))
		if p.NextCursor == nil {
			return out
		}
		cursor = p.NextCursor
	}
	f.t.Fatal("mehr als 20 Portionen: Fortsetzung endet nicht")
	return nil
}

func slugs(items []api.PostSummary) []string {
	out := make([]string, len(items))
	for i, p := range items {
		out[i] = p.Slug
	}
	return out
}

func ids(from, to int) []string { // absteigend von from bis to
	var out []string
	for i := from; i >= to; i-- {
		out = append(out, fmt.Sprintf("beitrag-%d", i))
	}
	return out
}

func equal(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestREQ75AC1ErsteAbrufLiefertZwanzigNeueste(t *testing.T) {
	f := newFeedDB(t)
	f.published(45)
	p := f.page("de", nil)
	if got, want := slugs(p.Items), ids(45, 26); !equal(got, want) {
		t.Fatalf("erste Portion = %v, erwartet die 20 neuesten %v", got, want)
	}
	if p.NextCursor == nil || *p.NextCursor == "" {
		t.Fatal("erste Portion von 45 Beiträgen muss nextCursor enthalten")
	}
}

func TestREQ75AC1WenigerAlsZwanzig(t *testing.T) {
	f := newFeedDB(t)
	f.published(7)
	p := f.page("en", nil)
	if got, want := slugs(p.Items), ids(7, 1); !equal(got, want) {
		t.Fatalf("Portion = %v, erwartet alle %v", got, want)
	}
	if p.NextCursor != nil {
		t.Fatalf("bei 7 Beiträgen kein nextCursor erwartet, erhalten %q", *p.NextCursor)
	}
}

func TestREQ75AC4FuenfundvierzigInDreiPortionen(t *testing.T) {
	f := newFeedDB(t)
	f.published(45)
	pages := f.all("de")
	if len(pages) != 3 || len(pages[0]) != 20 || len(pages[1]) != 20 || len(pages[2]) != 5 {
		t.Fatalf("Portionsgrößen = %v, erwartet 20/20/5", sizes(pages))
	}
	if !equal(pages[2], ids(5, 1)) {
		t.Fatalf("letzte Portion = %v, erwartet %v", pages[2], ids(5, 1))
	}
}

func TestREQ75AC4VolleLetztePortionOhneFortsetzung(t *testing.T) {
	f := newFeedDB(t)
	f.published(40)
	pages := f.all("de")
	if len(pages) != 2 || len(pages[1]) != 20 {
		t.Fatalf("Portionsgrößen = %v, erwartet 20/20 ohne leere dritte Portion", sizes(pages))
	}
}

func TestREQ75AC4KeineBeitraege(t *testing.T) {
	f := newFeedDB(t)
	f.post(1, "draft", "", "de")
	p := f.page("de", nil)
	if len(p.Items) != 0 || p.NextCursor != nil {
		t.Fatalf("leerer Bestand: %d Einträge, nextCursor=%v; erwartet 0 und keiner", len(p.Items), p.NextCursor)
	}
}

func TestREQ75AC2GleichesDatumAnPortionsgrenze(t *testing.T) {
	f := newFeedDB(t)
	// IDs 1..30; die IDs 15 bis 25 teilen sich ein Datum und liegen über der Grenze nach 20 Einträgen.
	// Die IDs sind absichtlich nicht nach Datum angelegt, damit eine Sortierung nur nach ID auffällt.
	same := "2026-06-01T09:00:00Z"
	var want []string
	for i := int64(1); i <= 30; i++ {
		switch {
		case i >= 15 && i <= 25:
			f.post(i, "published", same)
		case i < 15: // neuer als das gemeinsame Datum, ältere IDs zuerst neuer
			f.post(i, "published", time.Date(2026, 7, int(30-i), 9, 0, 0, 0, time.UTC).Format(time.RFC3339))
		default: // älter
			f.post(i, "published", time.Date(2026, 5, int(31-(i-25)), 9, 0, 0, 0, time.UTC).Format(time.RFC3339))
		}
	}
	for i := 1; i <= 14; i++ {
		want = append(want, fmt.Sprintf("beitrag-%d", i))
	}
	want = append(want, ids(25, 15)...)
	for i := 26; i <= 30; i++ {
		want = append(want, fmt.Sprintf("beitrag-%d", i))
	}
	pages := f.all("de")
	var got []string
	for _, p := range pages {
		got = append(got, p...)
	}
	if !equal(got, want) {
		t.Fatalf("Gesamtreihenfolge über %v Portionen =\n%v\nerwartet\n%v", sizes(pages), got, want)
	}
}

func TestREQ75AC2NeuerBeitragZwischenAbrufen(t *testing.T) {
	f := newFeedDB(t)
	f.published(45)
	first := f.page("de", nil)
	// Neuer Beitrag mit jüngstem Datum und ein weiterer mit gleichem Datum wie der letzte Eintrag der Portion,
	// aber höherer ID: beide gehören vor die Fortsetzungsstelle.
	f.post(100, "published", "2026-12-31T09:00:00Z")
	f.post(101, "published", time.Date(2026, 1, 1, 9, 0, 0, 0, time.UTC).AddDate(0, 0, 26).Format(time.RFC3339))
	second := f.page("de", first.NextCursor)
	if got, want := slugs(second.Items), ids(25, 6); !equal(got, want) {
		t.Fatalf("Fortsetzung nach Neuveröffentlichung = %v, erwartet %v", got, want)
	}
	var got []string
	for _, p := range f.all("de") {
		got = append(got, p...)
	}
	if len(got) != 47 || got[0] != "beitrag-100" || got[1] != "beitrag-45" {
		t.Fatalf("erneuter Abruf ab Feed-Anfang = %v, erwartet 47 Einträge mit beitrag-100 vorn", got)
	}
	// beitrag-101 teilt das Datum mit beitrag-26 und steht wegen höherer ID davor
	for i, s := range got {
		if s == "beitrag-101" {
			if i+1 >= len(got) || got[i+1] != "beitrag-26" {
				t.Fatalf("beitrag-101 muss direkt vor beitrag-26 stehen: %v", got)
			}
			return
		}
	}
	t.Fatalf("beitrag-101 fehlt am Feed-Anfang: %v", got)
}

func TestREQ75AC2UngueltigerCursor400(t *testing.T) {
	f := newFeedDB(t)
	f.published(3)
	l := api.Lang("de")
	bad := "kein-gueltiger-cursor"
	res, err := f.srv.ListPosts(context.Background(), api.ListPostsRequestObject{Params: api.ListPostsParams{Lang: &l, Cursor: &bad}})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := res.(api.ListPosts400JSONResponse); !ok {
		t.Fatalf("Antwort %T, erwartet 400", res)
	}
}

func TestREQ75AC7NurOeffentlichInBeidenSprachen(t *testing.T) {
	f := newFeedDB(t)
	f.published(25)
	// Entwurf und geplanter, noch nicht fälliger Beitrag mit jüngstem Datum bzw. Termin
	f.post(200, "draft", "")
	f.post(201, "draft", "")
	if _, err := f.db.Exec(`UPDATE posts SET scheduled_at = ? WHERE id = 201`, time.Now().Add(48*time.Hour).UTC().Format(time.RFC3339)); err != nil {
		t.Fatal(err)
	}
	// Nur deutsch vorliegender Beitrag, der erst in der zweiten Portion steht
	f.post(300, "published", "2026-01-02T12:00:00Z", "de")
	for _, lang := range []string{"de", "en"} {
		pages := f.all(lang)
		var got []string
		for _, p := range pages {
			got = append(got, p...)
		}
		if len(got) != 26 {
			t.Errorf("%s: %d Einträge, erwartet 26 öffentliche", lang, len(got))
		}
		for _, s := range got {
			if s == "beitrag-200" || s == "beitrag-201" {
				t.Errorf("%s: nicht öffentlicher %s erscheint", lang, s)
			}
		}
	}
	// Sprachfallback in der Folgeportion
	first := f.page("en", nil)
	second := f.page("en", first.NextCursor)
	for _, p := range second.Items {
		if p.Slug == "beitrag-300" {
			if p.Lang != "de" || p.Title != "Titel 300 de" {
				t.Fatalf("Fallback: lang=%s title=%q, erwartet de und deutschen Titel", p.Lang, p.Title)
			}
			return
		}
	}
	t.Fatalf("beitrag-300 fehlt in der zweiten englischen Portion: %v", slugs(second.Items))
}

func sizes(pages [][]string) []int {
	out := make([]int, len(pages))
	for i, p := range pages {
		out[i] = len(p)
	}
	return out
}
