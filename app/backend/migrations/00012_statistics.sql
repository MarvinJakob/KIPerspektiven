-- +goose Up
-- Statistik der Redaktion (Ticket #130, ADR 0010). Bewusst ohne Kennungen von Besucherinnen und Besuchern:
-- keine IP-Adressen, keine User-Agents, keine Einzelereignisse.

-- Seitenaufrufe nur als Tageszähler. day ist der Kalendertag in Europe/Berlin (JJJJ-MM-TT).
CREATE TABLE page_views (
    day   TEXT    PRIMARY KEY,
    views INTEGER NOT NULL CHECK (views >= 0)
);

-- Ergebnisse der Selbsteinschätzung, nur mit Einwilligung gespeichert. key_hash ist der SHA-256-Hash einer
-- zufälligen Kennung, die nur im Arbeitsspeicher des Browserfensters liegt. Sie erlaubt, dasselbe Ergebnis
-- zu aktualisieren oder zu löschen, solange das Fenster offen ist, und ist mit keiner Person verknüpft.
CREATE TABLE readiness_results (
    id           INTEGER PRIMARY KEY,
    key_hash     TEXT    NOT NULL UNIQUE,
    lang         TEXT    NOT NULL CHECK (lang IN ('de', 'en')),
    submitted_at TEXT    NOT NULL
);

CREATE INDEX readiness_results_submitted_at ON readiness_results (submitted_at);

CREATE TABLE readiness_result_ratings (
    result_id INTEGER NOT NULL REFERENCES readiness_results (id) ON DELETE CASCADE,
    dimension TEXT    NOT NULL,
    level     INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
    PRIMARY KEY (result_id, dimension)
);

-- +goose Down
DROP TABLE readiness_result_ratings;
DROP TABLE readiness_results;
DROP TABLE page_views;
