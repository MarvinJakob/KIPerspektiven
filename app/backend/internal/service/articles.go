package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"embed"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf16"

	"ki-web/backend/internal/api"
	"ki-web/backend/internal/media"
	"ki-web/backend/internal/store"
)

// Artikelbilder: hochgeladene Bilder der Medienablage oder die Originalgrafiken der überführten Artikel (#136).
var articleImageURL = regexp.MustCompile(`^/(media/[0-9a-f]{32}-960\.(jpg|png)|artikelbild-[a-z0-9-]+\.png)$`)
var articleAnchor = regexp.MustCompile(`^[a-z][a-z0-9-]*$`)

// validHref lässt nur https, http, mailto und Pfade der eigenen Webseite zu (REQ-136-AC9).
func validHref(href string) bool {
	if href == "" || strings.ContainsAny(href, " \t\r\n") {
		return false
	}
	lower := strings.ToLower(href)
	for _, scheme := range []string{"https://", "http://", "mailto:"} {
		if strings.HasPrefix(lower, scheme) {
			return len(href) > len(scheme)
		}
	}
	return strings.HasPrefix(href, "/") && !strings.HasPrefix(href, "//")
}

// validateSpans prüft Formatierungsbereiche: aufsteigend, ohne Überlappung, innerhalb des Texts (UTF-16).
func validateSpans(text string, spans []api.ArticleSpan) error {
	length, last := len(utf16.Encode([]rune(text))), 0
	for _, span := range spans {
		if span.Start < last || span.End <= span.Start || span.End > length {
			return invalid("Eine Formatierung liegt außerhalb ihres Texts. Bitte den Artikel neu laden und erneut speichern.")
		}
		if span.Href != "" && !validHref(span.Href) {
			return invalid("Ein Link hat ein unzulässiges Ziel. Erlaubt sind https://, http://, mailto: und Pfade der Webseite, die mit / beginnen.")
		}
		last = span.End
	}
	return nil
}

func validateArticleText(content api.ArticleText) error {
	if strings.TrimSpace(content.Title) == "" {
		return invalid("Bitte einen Titel eingeben.")
	}
	switch content.Layout {
	case "", "column", "wide", "magazine":
	default:
		return invalid("Unbekanntes Layout.")
	}
	return validateBlocks(content.Blocks, false)
}

func validateBlocks(blocks []api.ArticleBlock, nested bool) error {
	for i, block := range blocks {
		if block.Anchor != "" && !articleAnchor.MatchString(block.Anchor) {
			return invalid("Ein Sprungziel darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten.")
		}
		formatted := false
		switch block.Kind {
		case "paragraph", "lead", "info", "quote", "example":
			formatted = true
			fallthrough
		case "h1", "h2", "h3", "statement", "quoteheading":
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
				if err := validateSpans(item.Title, item.Spans); err != nil {
					return err
				}
				if err := validateSpans(item.Description, item.DescriptionSpans); err != nil {
					return err
				}
			}
		case "section", "conclusion":
			if nested {
				return invalid("Abschnitte und Fazit-Boxen können nicht ineinander liegen.")
			}
			if strings.TrimSpace(block.Text) == "" {
				return invalid("Bitte eine Überschrift für Baustein %d eingeben.", i+1)
			}
			if err := validateBlocks(block.Blocks, true); err != nil {
				return err
			}
		case "outline":
			if nested {
				return invalid("Die Abschnittsübersicht steht außerhalb der Abschnitte.")
			}
		case "related", "cta":
			if strings.TrimSpace(block.Text) == "" || (block.Kind == "cta" && strings.TrimSpace(block.Label) == "") {
				return invalid("Bitte Text für Baustein %d eingeben.", i+1)
			}
			if !validHref(block.Href) {
				return invalid("Bitte für Baustein %d ein Ziel angeben: https://, http://, mailto: oder einen Pfad der Webseite, der mit / beginnt.", i+1)
			}
		default:
			return invalid("Unbekannter Artikelbaustein.")
		}
		if len(block.Spans) > 0 && !formatted {
			return invalid("In Baustein %d ist keine Formatierung möglich.", i+1)
		}
		if err := validateSpans(block.Text, block.Spans); err != nil {
			return err
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
	// Stand (REQ-136-AC15): Datum der letzten inhaltlichen Änderung in deutscher Ortszeit.
	updated := e.now().In(articleZone).Format(time.DateOnly)
	if id != nil {
		current, err := q.GetEditorArticle(ctx, *id)
		if err != nil {
			return result, articleError(err)
		}
		currentAuthor, articleID = current.AuthorID, *id
		actor = currentAuthor
		if current.De == de && current.En == en {
			updated = current.Updated
		}
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
		articleID, err = q.InsertArticle(ctx, store.InsertArticleParams{AuthorID: actor, Status: string(input.Status), De: de, En: en, Updated: updated})
	} else {
		err = q.UpdateArticle(ctx, store.UpdateArticleParams{ID: articleID, AuthorID: actor, Status: string(input.Status), De: de, En: en, Updated: updated})
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
	out := api.EditorArticle{Id: id, AuthorId: row.AuthorID, AuthorActive: row.Active, AuthorLabel: label, Status: api.PostStatus(row.Status),
		TopicSlug: row.TopicSlug.String, Updated: row.Updated}
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
	out := api.PublishedArticle{Lang: "de", AuthorName: row.DisplayName, Updated: row.Updated}
	if row.StorageKey.Valid {
		out.AuthorAvatar = &api.Avatar{Src: media.URL(row.StorageKey.String, row.MimeType.String, "480"), Width: int(row.Width.Int64), Height: int(row.Height.Int64)}
	}
	content := row.De
	if lang == EN && row.En.Valid {
		out.Lang, content = "en", row.En.String
	}
	err = json.Unmarshal([]byte(content), &out.Content)
	return out, err
}

// TopicArticle liefert den veröffentlichten Themenartikel einer Themenadresse (REQ-136-AC4).
func (p *Public) TopicArticle(ctx context.Context, slug string, lang Lang) (api.PublishedArticle, error) {
	id, err := p.q.GetPublishedTopicArticleID(ctx, sql.NullString{String: slug, Valid: true})
	if err != nil {
		return api.PublishedArticle{}, articleError(err)
	}
	return p.Article(ctx, id, lang)
}

// articleZone (Europe/Berlin) ist die Zeitzone für den Stand der Themenartikel; die Zeitzonendaten sind eingebettet (statistics.go).
var articleZone = func() *time.Location {
	loc, err := time.LoadLocation("Europe/Berlin")
	if err != nil {
		panic(err)
	}
	return loc
}()

// topicArticles enthält die Fassungen der Artikel, die bis Ticket #136 im Quellcode der Webseite lagen.
//
//go:embed topicarticles/*.json
var topicArticles embed.FS

// Stand der überführten Artikel laut Textvorlage (#56) und Anzeigename ihres Autors.
const (
	importedUpdated = "2026-11-16"
	importedAuthor  = "Marvin Jakob"
)

var importedTopics = []string{"softwareentwicklung", "vibe-coding"}

// ImportTopicArticles legt die Artikel „KI in der Softwareentwicklung“ und „Vibe Coding“ einmalig als
// veröffentlichte Themenartikel an (REQ-136-AC1). Ohne Autorenkonto wartet die Überführung bis zum nächsten Start.
// Ein überführter und später gelöschter Artikel wird nicht erneut angelegt.
func (e *Editorial) ImportTopicArticles(ctx context.Context) error {
	for _, slug := range importedTopics {
		raw, err := topicArticles.ReadFile("topicarticles/" + slug + ".json")
		if err != nil {
			return err
		}
		var texts struct{ De, En api.ArticleText }
		if err := json.Unmarshal(raw, &texts); err != nil {
			return fmt.Errorf("artikel %s lesen: %w", slug, err)
		}
		de, err := encodeArticleText(texts.De)
		if err != nil {
			return fmt.Errorf("artikel %s (de): %w", slug, err)
		}
		en, err := encodeArticleText(texts.En)
		if err != nil {
			return fmt.Errorf("artikel %s (en): %w", slug, err)
		}
		if err := e.importTopicArticle(ctx, slug, de, en); err != nil {
			return fmt.Errorf("artikel %s überführen: %w", slug, err)
		}
	}
	return nil
}

func (e *Editorial) importTopicArticle(ctx context.Context, slug, de, en string) error {
	tx, err := e.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	q := e.q.WithTx(tx)
	if done, err := q.ArticleImported(ctx, slug); err != nil || done > 0 {
		return err
	}
	author, err := q.FindImportAuthor(ctx, importedAuthor)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if _, err := q.InsertArticle(ctx, store.InsertArticleParams{
		AuthorID: author, Status: "published", De: de, En: sql.NullString{String: en, Valid: true},
		Updated: importedUpdated, TopicSlug: sql.NullString{String: slug, Valid: true},
	}); err != nil {
		return err
	}
	if err := q.MarkArticleImported(ctx, store.MarkArticleImportedParams{TopicSlug: slug, ImportedAt: formatTime(e.now())}); err != nil {
		return err
	}
	return tx.Commit()
}
