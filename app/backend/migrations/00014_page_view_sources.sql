-- +goose Up
-- IP-Pseudonyme ohne Besuchsverlauf (Ticket #142, ADR 0010).
ALTER TABLE page_views ADD COLUMN identified_views INTEGER NOT NULL DEFAULT 0;
ALTER TABLE page_views ADD COLUMN unique_views INTEGER NOT NULL DEFAULT 0;
CREATE TABLE page_view_sources (
    ip_hash TEXT PRIMARY KEY NOT NULL,
    last_day TEXT NOT NULL
);
CREATE INDEX page_view_sources_last_day ON page_view_sources(last_day);
CREATE TABLE page_view_identity (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    key_id TEXT NOT NULL,
    started_at TEXT NOT NULL
);

-- +goose Down
DROP TABLE page_view_identity;
DROP TABLE page_view_sources;
ALTER TABLE page_views DROP COLUMN unique_views;
ALTER TABLE page_views DROP COLUMN identified_views;
