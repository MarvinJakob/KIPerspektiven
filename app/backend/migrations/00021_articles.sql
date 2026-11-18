-- +goose Up
CREATE TABLE articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
    de TEXT NOT NULL CHECK (json_valid(de)),
    en TEXT CHECK (en IS NULL OR json_valid(en))
);
CREATE INDEX articles_public ON articles(status, id);

-- +goose Down
DROP TABLE articles;
