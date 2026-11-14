-- +goose Up
-- Anfragen für ein kostenloses Beratungsgespräch nach der Selbsteinschätzung (Ticket #136, ADR 0011).
-- Gespeichert wird nur, was die Terminabstimmung braucht: E-Mail-Adresse, Sprache für die Antwort und
-- Zeitpunkt. Bewusst ohne IP-Adresse, User-Agent und ohne Ergebnis der Selbsteinschätzung.
-- Eine erneute Anfrage mit derselben Adresse aktualisiert den Eintrag, statt ihn zu verdoppeln.
-- Die Redaktion löscht Anfragen, sobald der Termin abgestimmt ist.
CREATE TABLE consultation_requests (
    id           INTEGER PRIMARY KEY,
    email        TEXT    NOT NULL UNIQUE,
    lang         TEXT    NOT NULL CHECK (lang IN ('de', 'en')),
    requested_at TEXT    NOT NULL
);

CREATE INDEX consultation_requests_requested_at ON consultation_requests (requested_at);

-- +goose Down
DROP TABLE consultation_requests;
