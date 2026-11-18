-- name: Ping :one
SELECT 1;

-- name: ListTopics :many
SELECT id, slug, sort_order FROM topics ORDER BY sort_order, id;

-- name: GetTopicBySlug :one
SELECT id, slug, sort_order FROM topics WHERE slug = ?;

-- name: ListTopicTranslations :many
SELECT topic_id, lang, title, label, summary, intro
FROM topic_translations
ORDER BY topic_id, lang;

-- name: CountPublishedPostsByTopic :many
SELECT pt.topic_id, COUNT(*) AS post_count
FROM post_topics pt
JOIN posts p ON p.id = pt.post_id
WHERE p.status = 'published'
GROUP BY pt.topic_id;

-- name: ListPublishedPosts :many
SELECT *
FROM posts
WHERE status = 'published'
ORDER BY published_at DESC, id DESC;

-- Portion der Blog-Uebersicht (Ticket #75): Keyset hinter (after_published_at, after_id) in derselben
-- Sortierung wie ListPublishedPosts. Ohne Fortsetzung (has_after = 0) beginnt die Liste vorn.
-- Kommentare vor Abfragen mit sqlc.arg ohne Umlaute: sqlc verschiebt sonst die Ersetzungspositionen.
-- name: ListPublishedPostsPage :many
SELECT *
FROM posts
WHERE status = 'published'
  AND (sqlc.arg(has_after) = 0
       OR published_at < sqlc.arg(after_published_at)
       OR (published_at = sqlc.arg(after_published_at) AND id < sqlc.arg(after_id)))
ORDER BY published_at DESC, id DESC
LIMIT sqlc.arg(row_limit);

-- name: ListPublishedPostsByTopic :many
SELECT p.*
FROM posts p
JOIN post_topics pt ON pt.post_id = p.id
WHERE pt.topic_id = ? AND p.status = 'published'
ORDER BY p.published_at DESC, p.id DESC;

-- name: GetPublishedPostBySlug :one
SELECT *
FROM posts
WHERE slug = ? AND status = 'published';

-- name: ListPostTranslationSummaries :many
SELECT post_id, lang, title, summary
FROM post_translations
WHERE post_id IN (sqlc.slice('post_ids'))
ORDER BY post_id, lang;

-- name: ListPostTranslations :many
SELECT post_id, lang, title, summary, body_markdown
FROM post_translations
WHERE post_id = ?
ORDER BY lang;

-- name: ListPostTopics :many
SELECT pt.post_id, pt.topic_id
FROM post_topics pt
JOIN topics t ON t.id = pt.topic_id
WHERE pt.post_id IN (sqlc.slice('post_ids'))
ORDER BY pt.post_id, t.sort_order, t.id;

-- name: ListMedia :many
SELECT id, storage_key, mime_type, width, height
FROM media
WHERE id IN (sqlc.slice('media_ids'));

-- name: GetMedia :one
SELECT id, storage_key, mime_type, width, height FROM media WHERE id = ?;

-- name: CreateMedia :execlastid
INSERT INTO media (storage_key, mime_type, width, height, created_at) VALUES (?, ?, ?, ?, ?);

-- name: DeleteMedia :exec
DELETE FROM media WHERE id = ?;

-- name: DeleteMediaTranslations :exec
DELETE FROM media_translations WHERE media_id = ?;

-- name: InsertMediaTranslation :exec
INSERT INTO media_translations (media_id, lang, alt_text) VALUES (?, ?, ?);

-- name: SetPostCover :execrows
UPDATE posts SET cover_media_id = ?, updated_at = ? WHERE id = ?;

-- name: ListMediaTranslations :many
SELECT media_id, lang, alt_text
FROM media_translations
WHERE media_id IN (sqlc.slice('media_ids'));

-- ---------------------------------------------------------------------------
-- Konten und Sitzungen der Redaktion (Anforderungen 6 und 11)
-- ---------------------------------------------------------------------------

-- name: CreateUser :execlastid
INSERT INTO users (email, password_hash, role, active, created_at)
VALUES (?, ?, ?, TRUE, ?);

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = ?;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = ?;

-- name: ListUsers :many
SELECT * FROM users ORDER BY email;

-- name: SetUserActive :execrows
UPDATE users SET active = ? WHERE id = ?;

-- name: CreateSession :exec
INSERT INTO sessions (id, user_id, csrf_token, expires_at, created_at)
VALUES (?, ?, ?, ?, ?);

-- name: GetSession :one
SELECT s.id, s.user_id, s.csrf_token, s.expires_at, u.email, u.role, u.active, u.display_name
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.id = ?;

-- name: DeleteSession :exec
DELETE FROM sessions WHERE id = ?;

-- name: DeleteUserSessions :exec
DELETE FROM sessions WHERE user_id = ?;

-- name: DeleteExpiredSessions :execrows
DELETE FROM sessions WHERE expires_at <= ?;

-- ---------------------------------------------------------------------------
-- Redaktion: Beitraege verwalten (Anforderung 5)
-- ---------------------------------------------------------------------------

-- name: ListAllPosts :many
SELECT * FROM posts ORDER BY updated_at DESC, id DESC;

-- name: GetPostByID :one
SELECT * FROM posts WHERE id = ?;

-- name: GetPostIDBySlug :one
SELECT id FROM posts WHERE slug = ?;

-- name: CreatePost :execlastid
INSERT INTO posts (slug, status, featured, author_id, updated_at) VALUES (?, 'draft', ?, ?, ?);

-- name: UpdatePost :execrows
UPDATE posts SET slug = ?, featured = ?, updated_at = ? WHERE id = ?;

-- Loeschen eines Beitrags (Ticket #24). Sprachfassungen und Themenzuordnungen entfernt ON DELETE CASCADE.
-- name: DeletePost :execrows
DELETE FROM posts WHERE id = ?;

-- name: DeletePostTranslations :exec
DELETE FROM post_translations WHERE post_id = ?;

-- name: InsertPostTranslation :exec
INSERT INTO post_translations (post_id, lang, title, summary, body_markdown) VALUES (?, ?, ?, ?, ?);

-- name: DeletePostTopics :exec
DELETE FROM post_topics WHERE post_id = ?;

-- name: InsertPostTopic :exec
INSERT INTO post_topics (post_id, topic_id) VALUES (?, ?);

-- name: PublishPost :execrows
UPDATE posts
SET status = 'published',
    published_at = COALESCE(published_at, sqlc.arg(published_at)),
    scheduled_at = NULL,
    updated_at = sqlc.arg(updated_at)
WHERE id = sqlc.arg(id);

-- name: UnpublishPost :execrows
UPDATE posts SET status = 'draft', updated_at = ? WHERE id = ?;

-- Geplante Veroeffentlichung (Ticket #23). Zeitpunkte in UTC, RFC 3339 ohne Sekundenbruchteile,
-- damit der Textvergleich der zeitlichen Reihenfolge entspricht.

-- name: SchedulePost :execrows
UPDATE posts SET scheduled_at = ?, updated_at = ? WHERE id = ? AND status = 'draft';

-- name: UnschedulePost :execrows
UPDATE posts SET scheduled_at = NULL, updated_at = ? WHERE id = ?;

-- name: ListDuePosts :many
SELECT id, scheduled_at FROM posts
WHERE status = 'draft' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
ORDER BY scheduled_at, id;

-- Ticket #31: Eine automatische Veroeffentlichung traegt immer den geplanten Zeitpunkt als Datum,
-- auch wenn der Beitrag frueher schon einmal veroeffentlicht war.
-- name: PublishScheduledPost :execrows
UPDATE posts
SET status = 'published',
    published_at = scheduled_at,
    scheduled_at = NULL,
    updated_at = sqlc.arg(updated_at)
WHERE id = sqlc.arg(id) AND status = 'draft' AND scheduled_at IS NOT NULL
  -- Ticket #30: Der Termin muss beim Schreiben noch faellig sein. Wurde er nach dem Einlesen
  -- verschoben, aendert sich nichts.
  AND scheduled_at <= sqlc.arg(now);

-- name: UnscheduleDuePost :execrows
UPDATE posts SET scheduled_at = NULL, updated_at = sqlc.arg(updated_at)
WHERE id = sqlc.arg(id) AND status = 'draft' AND scheduled_at <= sqlc.arg(now);

-- ---------------------------------------------------------------------------
-- Statistik der Redaktion (Ticket #130). Zeitraeume beginnen bei einem Tag bzw. Zeitpunkt; "" heisst gesamt.
-- ---------------------------------------------------------------------------

-- name: CountPageView :exec
INSERT INTO page_views (day, views) VALUES (?, 1)
ON CONFLICT (day) DO UPDATE SET views = views + 1;

-- name: ListPageViews :many
SELECT day, views, identified_views, unique_views FROM page_views
WHERE day >= sqlc.arg(since) AND day <= sqlc.arg(until) ORDER BY day DESC;

-- name: GetPageViewSource :one
SELECT last_day FROM page_view_sources WHERE ip_hash = ?;

-- name: UpsertPageViewSource :exec
INSERT INTO page_view_sources (ip_hash, last_day) VALUES (?, ?)
ON CONFLICT(ip_hash) DO UPDATE SET last_day = MAX(last_day, excluded.last_day);

-- name: CountIdentifiedPageView :exec
UPDATE page_views SET identified_views = identified_views + 1,
unique_views = unique_views + sqlc.arg(new_source) WHERE day = sqlc.arg(day);

-- name: CountPageViewSources :one
SELECT COUNT(*) FROM page_view_sources WHERE last_day >= ?;

-- name: GetPageViewIdentity :one
SELECT key_id, started_at FROM page_view_identity WHERE id = 1;

-- name: SetPageViewIdentity :exec
INSERT INTO page_view_identity (id, key_id, started_at) VALUES (1, ?, ?)
ON CONFLICT(id) DO UPDATE SET key_id = excluded.key_id, started_at = excluded.started_at;

-- name: DeletePageViewSources :exec
DELETE FROM page_view_sources;

-- name: InvalidatePageViewDay :exec
UPDATE page_views SET identified_views = -1 WHERE day = ? AND views > 0;

-- name: GetReadinessResultByKey :one
SELECT id, lang FROM readiness_results WHERE key_hash = ?;

-- name: CreateReadinessResult :execlastid
INSERT INTO readiness_results (key_hash, lang, submitted_at) VALUES (?, ?, ?);

-- name: UpdateReadinessResult :exec
UPDATE readiness_results SET lang = ?, submitted_at = ? WHERE id = ?;

-- name: DeleteReadinessResultByKey :exec
DELETE FROM readiness_results WHERE key_hash = ?;

-- name: DeleteReadinessRatings :exec
DELETE FROM readiness_result_ratings WHERE result_id = ?;

-- name: InsertReadinessRating :exec
INSERT INTO readiness_result_ratings (result_id, dimension, level) VALUES (?, ?, ?);

-- name: CountReadinessResults :one
SELECT COUNT(*) FROM readiness_results WHERE submitted_at >= ?;

-- name: ListReadinessResults :many
SELECT id, lang, submitted_at FROM readiness_results
WHERE submitted_at >= sqlc.arg(since)
ORDER BY submitted_at DESC, id DESC
LIMIT sqlc.arg(page_size) OFFSET sqlc.arg(skip);

-- name: ListReadinessRatings :many
SELECT result_id, dimension, level FROM readiness_result_ratings
WHERE result_id IN (sqlc.slice('result_ids'))
ORDER BY result_id, dimension;

-- ---------------------------------------------------------------------------
-- Anfragen fuer ein Beratungsgespraech (Ticket #136). Dieselbe Adresse ergibt keinen zweiten Eintrag.
-- ---------------------------------------------------------------------------

-- name: UpsertConsultationRequest :exec
INSERT INTO consultation_requests (email, lang, requested_at) VALUES (?, ?, ?)
ON CONFLICT (email) DO UPDATE SET lang = excluded.lang, requested_at = excluded.requested_at;

-- name: ListConsultationRequests :many
SELECT id, email, lang, requested_at FROM consultation_requests ORDER BY requested_at DESC, id DESC;

-- name: DeleteConsultationRequest :execrows
DELETE FROM consultation_requests WHERE id = ?;

-- ---------------------------------------------------------------------------
-- Nachrichten der Kontaktseite (Anforderung #4)
-- ---------------------------------------------------------------------------

-- name: InsertContactMessage :exec
INSERT INTO contact_messages (name, company, email, message, lang, received_at) VALUES (?, ?, ?, ?, ?, ?);

-- name: GetPublishedArticle :one
SELECT a.de, a.en, u.display_name FROM articles a
JOIN users u ON u.id = a.author_id
WHERE a.id = ? AND a.status = 'published';

-- name: ListArticleSummaries :many
SELECT id, status,
  CAST(json_extract(CASE WHEN @lang = 'en' AND en IS NOT NULL THEN en ELSE de END, '$.title') AS TEXT) AS title,
  CAST(coalesce(json_extract(CASE WHEN @lang = 'en' AND en IS NOT NULL THEN en ELSE de END, '$.subtitle'), '') AS TEXT) AS subtitle
FROM articles WHERE @editorial OR status = 'published'
ORDER BY id DESC;

-- name: GetEditorArticle :one
SELECT a.*, u.email, u.display_name, u.active
FROM articles a JOIN users u ON u.id = a.author_id WHERE a.id = ?;

-- name: InsertArticle :one
INSERT INTO articles (status, author_id, de, en) VALUES (?, ?, ?, ?) RETURNING id;

-- name: UpdateArticle :exec
UPDATE articles SET status = ?, author_id = ?, de = ?, en = ? WHERE id = ?;

-- name: DeleteArticle :execrows
DELETE FROM articles WHERE id = ?;

-- name: ListContactMessages :many
SELECT id, name, company, email, message, lang, received_at FROM contact_messages ORDER BY received_at DESC, id DESC;

-- ---------------------------------------------------------------------------
-- Rollen, Profil und Autoren (Ticket #64)
-- ---------------------------------------------------------------------------

-- Rollen der Konten. Ein Konto ohne Eintrag (angelegt von einer Version vor #64, etwa nach einem Rollback)
-- behaelt seine Rolle aus der alten Spalte users.role. Das uebernimmt der Dienst.
-- name: ListUserRoles :many
SELECT user_id, role FROM user_roles WHERE user_id IN (sqlc.slice('user_ids')) ORDER BY user_id, role;

-- name: ListAllUserRoles :many
SELECT user_id, role FROM user_roles ORDER BY user_id, role;

-- name: InsertUserRole :exec
INSERT INTO user_roles (user_id, role) VALUES (?, ?);

-- name: DeleteUserRoles :exec
DELETE FROM user_roles WHERE user_id = ?;

-- name: SetUserLegacyRole :exec
UPDATE users SET role = ? WHERE id = ?;

-- name: SetUserDisplayName :execrows
UPDATE users SET display_name = ? WHERE id = ?;

-- name: SetUserAvatar :execrows
UPDATE users SET avatar_media_id = ? WHERE id = ?;

-- name: SetUserPassword :execrows
UPDATE users SET password_hash = ? WHERE id = ?;

-- name: DeleteOtherUserSessions :exec
DELETE FROM sessions WHERE user_id = ? AND id <> ?;

-- name: GetUserAvatar :one
SELECT m.id, m.storage_key, m.mime_type, m.width, m.height
FROM users u JOIN media m ON m.id = u.avatar_media_id
WHERE u.id = ?;

-- name: SetPostAuthor :execrows
UPDATE posts SET author_id = ?, updated_at = ? WHERE id = ?;

-- name: GetPublicAuthor :one
SELECT u.display_name, m.storage_key, m.mime_type, m.width, m.height
FROM users u LEFT JOIN media m ON m.id = u.avatar_media_id
WHERE u.id = ?;
