package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"regexp"
	"strings"

	"ki-web/backend/internal/api"
	"ki-web/backend/internal/store"
)

var articleImageURL = regexp.MustCompile(`^/media/[0-9a-f]{32}-960\.(jpg|png)$`)

func validateArticleText(content api.ArticleText) error {
	if strings.TrimSpace(content.Title) == "" {
		return invalid("Bitte einen Titel eingeben.")
	}
	for i, block := range content.Blocks {
		switch block.Kind {
		case "paragraph", "h1", "h2", "h3", "info", "quote":
			if strings.TrimSpace(block.Text) == "" {
				return invalid("Bitte Text für Baustein %d eingeben.", i+1)
			}
		case "image":
			if !articleImageURL.MatchString(block.Src) {
				return invalid("Bitte in Baustein %d ein Bild hochladen.", i+1)
			}
			if strings.TrimSpace(block.Alt) == "" {
				return invalid("Bitte einen Alternativtext für Bild %d eingeben.", i+1)
			}
		case "ordered", "unordered":
			if len(block.Items) == 0 {
				return invalid("Bitte einen Listeneintrag hinzufügen.")
			}
			for _, item := range block.Items {
				if strings.TrimSpace(item.Title) == "" {
					return invalid("Jeder Listeneintrag braucht einen Titel.")
				}
			}
		default:
			return invalid("Unbekannter Artikelbaustein.")
		}
	}
	return nil
}

func encodeArticleText(text api.ArticleText) (string, error) {
	if err := validateArticleText(text); err != nil {
		return "", err
	}
	text.Title = strings.TrimSpace(text.Title)
	text.Subtitle = strings.TrimSpace(text.Subtitle)
	if text.Blocks == nil {
		text.Blocks = []api.ArticleBlock{}
	}
	b, err := json.Marshal(text)
	return string(b), err
}

func (e *Editorial) SaveArticle(ctx context.Context, id *int64, actor int64, input api.ArticleInput) (api.EditorArticle, error) {
	var result api.EditorArticle
	if !input.Status.Valid() {
		return result, invalid("Unbekannter Veröffentlichungsstatus.")
	}
	de, err := encodeArticleText(input.De)
	if err != nil {
		return result, err
	}
	var en sql.NullString
	if input.En != nil {
		value, err := encodeArticleText(*input.En)
		if err != nil {
			return result, invalid("Englische Fassung: %s", err)
		}
		en = sql.NullString{String: value, Valid: true}
	}
	tx, err := e.db.BeginTx(ctx, nil)
	if err != nil {
		return result, err
	}
	defer tx.Rollback()
	q := e.q.WithTx(tx)
	var currentAuthor, articleID int64
	if id != nil {
		current, err := q.GetEditorArticle(ctx, *id)
		if err != nil {
			return result, articleError(err)
		}
		currentAuthor, articleID = current.AuthorID, *id
		actor = currentAuthor
	}
	if input.AuthorId != nil {
		actor = *input.AuthorId
	}
	if id == nil || actor != currentAuthor {
		eligible, err := canAuthor(ctx, q, actor)
		if err != nil {
			return result, err
		}
		if !eligible {
			return result, invalid("Bitte ein aktives Konto mit Redaktionsberechtigung wählen.")
		}
	}
	if id == nil {
		articleID, err = q.InsertArticle(ctx, store.InsertArticleParams{AuthorID: actor, Status: string(input.Status), De: de, En: en})
	} else {
		err = q.UpdateArticle(ctx, store.UpdateArticleParams{ID: articleID, AuthorID: actor, Status: string(input.Status), De: de, En: en})
	}
	if err != nil {
		return result, err
	}
	result, err = loadArticle(ctx, q, articleID)
	if err != nil {
		return result, err
	}
	return result, tx.Commit()
}

func articleError(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func loadArticle(ctx context.Context, q *store.Queries, id int64) (api.EditorArticle, error) {
	row, err := q.GetEditorArticle(ctx, id)
	if err != nil {
		return api.EditorArticle{}, articleError(err)
	}
	label := row.DisplayName
	if label == "" {
		label = row.Email
	}
	out := api.EditorArticle{Id: id, AuthorId: row.AuthorID, AuthorActive: row.Active, AuthorLabel: label, Status: api.PostStatus(row.Status)}
	if err := json.Unmarshal([]byte(row.De), &out.De); err != nil {
		return out, err
	}
	if row.En.Valid {
		err = json.Unmarshal([]byte(row.En.String), &out.En)
	}
	return out, err
}

func (e *Editorial) Article(ctx context.Context, id int64) (api.EditorArticle, error) {
	return loadArticle(ctx, e.q, id)
}
func (e *Editorial) DeleteArticle(ctx context.Context, id int64) error {
	n, err := e.q.DeleteArticle(ctx, id)
	if err == nil && n == 0 {
		return ErrNotFound
	}
	return err
}

func articleSummaries(ctx context.Context, q store.Querier, lang Lang, editorial bool) (api.ArticleList, error) {
	rows, err := q.ListArticleSummaries(ctx, store.ListArticleSummariesParams{Lang: string(lang), Editorial: editorial})
	if err != nil {
		return api.ArticleList{}, err
	}
	out := api.ArticleList{Items: make([]api.ArticleSummary, 0, len(rows))}
	for _, row := range rows {
		item := api.ArticleSummary{Id: row.ID, Title: row.Title, Subtitle: row.Subtitle}
		if editorial {
			status := api.PostStatus(row.Status)
			item.Status = &status
		}
		out.Items = append(out.Items, item)
	}
	return out, nil
}
func (e *Editorial) Articles(ctx context.Context) (api.ArticleList, error) {
	return articleSummaries(ctx, e.q, DE, true)
}
func (p *Public) Articles(ctx context.Context, lang Lang) (api.ArticleList, error) {
	return articleSummaries(ctx, p.q, lang, false)
}
func (p *Public) Article(ctx context.Context, id int64, lang Lang) (api.PublishedArticle, error) {
	row, err := p.q.GetPublishedArticle(ctx, id)
	if err != nil {
		return api.PublishedArticle{}, articleError(err)
	}
	out := api.PublishedArticle{Lang: "de", AuthorName: row.DisplayName}
	content := row.De
	if lang == EN && row.En.Valid {
		out.Lang, content = "en", row.En.String
	}
	err = json.Unmarshal([]byte(content), &out.Content)
	return out, err
}
