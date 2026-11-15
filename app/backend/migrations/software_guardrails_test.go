package migrations_test

import (
	"context"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/pressly/goose/v3"
	"ki-web/backend/internal/store"
	"ki-web/backend/migrations"
)

// Ein bestehendes Thema muss nach Up/Down dieselben Texte und Beitragszuordnungen haben.
func TestSoftwareGuardrailsUpgradeAndRollback(t *testing.T) {
	testSoftwareMetadataMigration(t, 4, 6,
		"Wie Sie KI-Assistenten mit Markdown-Regeln, Zugriffsrechten, Tests und Reviews anleiten.",
		"How to guide AI assistants with Markdown rules, access permissions, tests and reviews.")
}

func TestSoftwareDevelopmentUpgradeAndRollback(t *testing.T) {
	testSoftwareMetadataMigration(t, 14, 15,
		"Wie Sie mit KI Software entwickeln, Ergebnisse prüfen und die Flut an Änderungen beherrschen.",
		"How to develop software with AI, verify results and manage the flood of changes.")
}

func testSoftwareMetadataMigration(t *testing.T, from, to int64, summaryDE, summaryEN string) {
	t.Helper()
	db, err := store.Open(filepath.Join(t.TempDir(), "migration.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	p, err := goose.NewProvider(goose.DialectSQLite3, db, migrations.Schema, goose.WithDisableGlobalRegistry(true))
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if _, err := p.UpTo(ctx, from); err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO posts (id, slug, status, published_at, updated_at) VALUES (100, 'bestand', 'published', '2026-11-09T10:00:00Z', '2026-11-09T10:00:00Z');
		INSERT INTO post_topics (post_id, topic_id) VALUES (100, 1);`)
	if err != nil {
		t.Fatal(err)
	}
	read := func() map[string][4]string {
		rows, err := db.Query("SELECT lang, title, label, summary, intro FROM topic_translations WHERE topic_id = 1")
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		result := map[string][4]string{}
		for rows.Next() {
			var lang string
			var text [4]string
			if err := rows.Scan(&lang, &text[0], &text[1], &text[2], &text[3]); err != nil {
				t.Fatal(err)
			}
			result[lang] = text
		}
		if err := rows.Err(); err != nil {
			t.Fatal(err)
		}
		return result
	}
	original := read()
	if _, err := p.UpTo(ctx, to); err != nil {
		t.Fatal(err)
	}
	updated := read()
	if updated["de"][0] != "KI in der Softwareentwicklung" || updated["de"][2] != summaryDE || updated["en"][2] != summaryEN {
		t.Fatalf("Metadaten nicht aktualisiert: %+v", updated)
	}
	if _, err := p.Down(ctx); err != nil {
		t.Fatal(err)
	}
	if restored := read(); !reflect.DeepEqual(restored, original) {
		t.Fatalf("Down stellt alte Texte nicht wieder her: %+v", restored)
	}
	var slug string
	if err := db.QueryRow("SELECT slug FROM topics JOIN post_topics ON topic_id = topics.id WHERE post_id = 100").Scan(&slug); err != nil || slug != "softwareentwicklung" {
		t.Fatalf("Beitragszuordnung verloren: %s, %v", slug, err)
	}
	if _, err := p.UpTo(ctx, to); err != nil {
		t.Fatal(err)
	}
	if reapplied := read(); !reflect.DeepEqual(reapplied, updated) {
		t.Fatalf("Erneutes Up verändert Texte: %+v", reapplied)
	}
}
