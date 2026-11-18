-- +goose Up
-- Testkonto mit ausschließlich der Rolle Marketing (Ticket #64). Nur mit DEV_SEED=true.
--   marketing@example.test  Rolle marketing  Passwort marketing-test-1
-- Die alte Spalte users.role kennt kein marketing; sie wird wie im Backend mit editor gefüllt (Rollback-Hinweis
-- in docs/betrieb.md). Maßgeblich ist user_roles.

INSERT INTO users (email, password_hash, role, active, created_at) VALUES
    ('marketing@example.test', '$argon2id$v=19$m=65536,t=2,p=1$HLduiBa23Q3SuH4Z+V1Rhw$GanoCHuwIlbcmsqEpQyGE198gG6DB0rUTSbd6G2i0DE', 'editor', TRUE, '2026-11-18T09:00:00Z');
INSERT INTO user_roles (user_id, role) SELECT id, 'marketing' FROM users WHERE email = 'marketing@example.test';

-- +goose Down
DELETE FROM users WHERE email = 'marketing@example.test';
