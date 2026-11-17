-- +goose Up
-- Nachrichten von der öffentlichen Kontaktseite (Anforderung #4). Gespeichert wird, was die Person angibt
-- (Name, optional Unternehmen, E-Mail-Adresse, Nachricht), dazu Sprache der Seite und Zeitpunkt. Bewusst ohne
-- IP-Adresse und User-Agent. Einsehbar nur für angemeldete Redaktionskonten (editor, admin).
CREATE TABLE contact_messages (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    company     TEXT    NOT NULL DEFAULT '',
    email       TEXT    NOT NULL,
    message     TEXT    NOT NULL,
    lang        TEXT    NOT NULL CHECK (lang IN ('de', 'en')),
    received_at TEXT    NOT NULL
);

CREATE INDEX contact_messages_received_at ON contact_messages (received_at);

-- +goose Down
DROP TABLE contact_messages;
