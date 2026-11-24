-- +goose Up
-- Testkonto für den Autor der überführten Themenartikel (Ticket #136). Nur mit DEV_SEED=true.
--   marvin.jakob@example.test  Rolle editor  Anzeigename „Marvin Jakob“
-- Das Konto dient nur als Autor; zu seinem Passwort-Hash ist kein Passwort bekannt.

INSERT INTO users (email, password_hash, role, active, created_at, display_name) VALUES
    ('marvin.jakob@example.test', '$argon2id$v=19$m=65536,t=2,p=1$Q0dGc2tSb1h2aE5wQmF1dA$7mTn0Yc1v3p2s0aXkq8Jw5hZr4dU6eLb9oIfGyHxVtM', 'editor', TRUE, '2026-11-24T09:00:00Z', 'Marvin Jakob');
INSERT INTO user_roles (user_id, role) SELECT id, 'editor' FROM users WHERE email = 'marvin.jakob@example.test';

-- +goose Down
DELETE FROM users WHERE email = 'marvin.jakob@example.test';
