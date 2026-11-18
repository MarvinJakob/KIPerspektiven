-- +goose Up
-- Ticket #85: Beiträge automatisch auf LinkedIn teilen. Additiv (docs/betrieb.md): neue Tabellen, keine Änderung
-- bestehender Spalten. Eine frühere Version ignoriert die Tabellen nach einem Rollback.

-- Einstellungen je Plattform. In dieser Ausbaustufe gibt es nur 'linkedin'. Das Zugriffstoken verlässt das Backend nie.
CREATE TABLE social_connections (
    platform         TEXT    PRIMARY KEY CHECK (platform IN ('linkedin')),
    enabled          BOOLEAN NOT NULL DEFAULT FALSE,
    preferred_lang   TEXT    NOT NULL DEFAULT 'de' CHECK (preferred_lang IN ('de', 'en')),
    member_id        TEXT    NOT NULL DEFAULT '',
    member_name      TEXT    NOT NULL DEFAULT '',
    access_token     TEXT    NOT NULL DEFAULT '',
    token_expires_at TEXT,
    connected_at     TEXT,
    updated_at       TEXT    NOT NULL
);

-- Höchstens ein Versand je Beitrag und Plattform. Der Eintrag entsteht in derselben Transaktion wie die
-- Erstveröffentlichung; der Hintergrundlauf sendet ihn danach.
CREATE TABLE social_shares (
    post_id    INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    platform   TEXT    NOT NULL CHECK (platform IN ('linkedin')),
    status     TEXT    NOT NULL CHECK (status IN ('pending', 'sending', 'succeeded', 'failed', 'unknown')),
    lang       TEXT    NOT NULL DEFAULT '',
    post_urn   TEXT    NOT NULL DEFAULT '',
    message    TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL,
    PRIMARY KEY (post_id, platform)
);

CREATE INDEX social_shares_status ON social_shares (status);

-- +goose Down
DROP TABLE social_shares;
DROP TABLE social_connections;
