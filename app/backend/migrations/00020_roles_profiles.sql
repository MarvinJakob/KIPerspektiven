-- +goose Up
-- Ticket #64: mehrere Rollen je Konto, eigenes Profil und Autoren redaktioneller Beiträge.
-- Additiv (docs/betrieb.md): Die Spalte users.role bleibt bestehen und wird weiter gepflegt (admin, sonst editor),
-- damit eine frühere Version nach einem Rollback startet. Maßgeblich ist ab jetzt user_roles.

CREATE TABLE user_roles (
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role    TEXT    NOT NULL CHECK (role IN ('admin', 'editor', 'marketing')),
    PRIMARY KEY (user_id, role)
);

-- REQ-64-AC10: Bestehende Konten behalten ihre Rolle (admin → Admin, editor → Redakteur).
INSERT INTO user_roles (user_id, role) SELECT id, role FROM users;

ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN avatar_media_id INTEGER REFERENCES media (id) ON DELETE SET NULL;

-- Bestehende Beiträge bleiben ohne Autor (Entscheidung 3 vom 18.11.2026).
ALTER TABLE posts ADD COLUMN author_id INTEGER REFERENCES users (id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE posts DROP COLUMN author_id;
ALTER TABLE users DROP COLUMN avatar_media_id;
ALTER TABLE users DROP COLUMN display_name;
DROP TABLE user_roles;
