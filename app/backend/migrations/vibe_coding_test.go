package migrations_test

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/pressly/goose/v3"
	"ki-web/backend/internal/store"
	"ki-web/backend/migrations"
)

func TestVibeCodingUpgradeAndRollback(t *testing.T) {
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
	if _, err = p.UpTo(ctx, 17); err != nil {
		t.Fatal(err)
	}
	// Existing IDs and article associations must survive both upgrade and rollback.
	if _, err = db.Exec(`INSERT INTO topics (id, slug, sort_order) VALUES (42, 'existing', 42);
		INSERT INTO posts (id, slug, status, updated_at) VALUES (100, 'existing', 'draft', '2026-11-17T10:00:00Z');
		INSERT INTO post_topics (post_id, topic_id) VALUES (100, 42);`); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if _, err = p.UpTo(ctx, 18); err != nil {
			t.Fatal(err)
		}
		var count int
		if err = db.QueryRow(`SELECT COUNT(*) FROM topic_translations JOIN topics ON topic_id = topics.id
			WHERE slug = 'vibe-coding' AND lang IN ('de', 'en') AND title = 'Vibe Coding' AND intro <> '' AND summary <> ''`).Scan(&count); err != nil || count != 2 {
			t.Fatalf("Vibe Coding translations: %d, %v", count, err)
		}
		if _, err = p.Down(ctx); err != nil {
			t.Fatal(err)
		}
		if err = db.QueryRow(`SELECT COUNT(*) FROM topics WHERE slug = 'vibe-coding'`).Scan(&count); err != nil || count != 0 {
			t.Fatalf("rollback: %d, %v", count, err)
		}
		if err = db.QueryRow(`SELECT COUNT(*) FROM post_topics WHERE post_id = 100 AND topic_id = 42`).Scan(&count); err != nil || count != 1 {
			t.Fatalf("existing association: %d, %v", count, err)
		}
	}
}
