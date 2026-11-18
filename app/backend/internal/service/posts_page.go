package service

import (
	"context"
	"database/sql"
	"encoding/base64"
	"errors"
	"strconv"
	"strings"

	"ki-web/backend/internal/store"
)

// PostsPageSize ist die feste Zahl der Beiträge je Abruf der Blogübersicht (Ticket #75).
const PostsPageSize = 20

// ErrBadCursor bedeutet: Die Fortsetzungsmarke ist ungültig.
var ErrBadCursor = errors.New("ungültige Fortsetzungsmarke")

// PostsPage ist eine Portion der Blogübersicht. NextCursor ist leer, wenn keine weiteren Beiträge folgen.
type PostsPage struct {
	Items      []PostSummary
	NextCursor string
}

// PostsPage liefert die nächste Portion veröffentlichter Beiträge, neueste zuerst und bei gleichem Datum nach
// ID absteigend. Ohne cursor beginnt die Liste vorn. Die Fortsetzung schließt direkt an den letzten Eintrag
// der vorigen Portion an (Keyset), damit neu vorn einsortierte Beiträge sie nicht verschieben (REQ-75-AC2).
func (s *Public) PostsPage(ctx context.Context, lang Lang, cursor string) (PostsPage, error) {
	// Ein Eintrag mehr zeigt, ob eine weitere Portion folgt (REQ-75-AC4).
	params := store.ListPublishedPostsPageParams{HasAfter: int64(0), RowLimit: PostsPageSize + 1}
	if cursor != "" {
		at, id, err := decodeCursor(cursor)
		if err != nil {
			return PostsPage{}, err
		}
		params.HasAfter, params.AfterPublishedAt, params.AfterID = int64(1), sql.NullString{String: at, Valid: true}, id
	}
	idx, err := s.topicIndex(ctx)
	if err != nil {
		return PostsPage{}, err
	}
	rows, err := s.q.ListPublishedPostsPage(ctx, params)
	if err != nil {
		return PostsPage{}, err
	}
	var next string
	if len(rows) > PostsPageSize {
		rows = rows[:PostsPageSize]
		last := rows[len(rows)-1]
		// Die Marke folgt der letzten Datenbankzeile, nicht dem letzten darstellbaren Eintrag: So bleibt die
		// Fortsetzung korrekt, auch wenn summaries einzelne Zeilen ohne Text auslässt.
		next = encodeCursor(last.PublishedAt.String, last.ID)
	}
	items, err := s.summaries(ctx, rows, lang, idx)
	if err != nil {
		return PostsPage{}, err
	}
	return PostsPage{Items: items, NextCursor: next}, nil
}

const cursorMaxLen = 200

// encodeCursor kodiert Veröffentlichungsdatum (wie gespeichert) und ID URL-sicher.
func encodeCursor(publishedAt string, id int64) string {
	return base64.RawURLEncoding.EncodeToString([]byte(publishedAt + "|" + strconv.FormatInt(id, 10)))
}

func decodeCursor(c string) (string, int64, error) {
	if c == "" || len(c) > cursorMaxLen {
		return "", 0, ErrBadCursor
	}
	raw, err := base64.RawURLEncoding.DecodeString(c)
	if err != nil {
		return "", 0, ErrBadCursor
	}
	at, idText, ok := strings.Cut(string(raw), "|")
	if !ok || at == "" || parseTime(at).IsZero() {
		return "", 0, ErrBadCursor
	}
	id, err := strconv.ParseInt(idText, 10, 64)
	if err != nil || id <= 0 {
		return "", 0, ErrBadCursor
	}
	return at, id, nil
}
