-- +goose Up
-- Ticket #136: Themenartikel können unter einer Themenadresse (/themen/<slug>) erscheinen und tragen einen Stand.
-- Additiv (docs/betrieb.md): neue Spalten mit Standardwert und eine neue Tabelle.
ALTER TABLE articles ADD COLUMN topic_slug TEXT;
ALTER TABLE articles ADD COLUMN updated TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX articles_topic ON articles(topic_slug) WHERE topic_slug IS NOT NULL;

-- Merkt sich einmalig überführte Artikel, damit ein gelöschter Artikel nicht erneut angelegt wird.
CREATE TABLE article_imports (
    topic_slug  TEXT PRIMARY KEY,
    imported_at TEXT NOT NULL
);

-- +goose Down
DROP TABLE article_imports;
DROP INDEX articles_topic;
ALTER TABLE articles DROP COLUMN updated;
ALTER TABLE articles DROP COLUMN topic_slug;
