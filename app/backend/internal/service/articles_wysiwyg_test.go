package service

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"testing"
	"time"

	"ki-web/backend/internal/api"
)

// Unit-Tests zu Ticket #136 (Themenartikel im WYSIWYG-Editor) gegen eine echte SQLite-Datenbank.
// Sollwerte stammen aus der Spezifikation REQ-136, nicht aus dem Code.

func newArticleTest(t *testing.T) (*Editorial, *Public, *testClock, *Accounts, User) {
	t.Helper()
	a, db := newAccountsTest(t)
	clock := &testClock{t: time.Date(2026, 11, 24, 11, 0, 0, 0, time.UTC)}
	e := NewEditorial(db)
	e.now = clock.now
	admin := mustCreate(t, a, "admin@example.test", RoleAdmin)
	return e, NewPublic(e.q), clock, a, admin
}

func articleText(blocks ...api.ArticleBlock) api.ArticleText {
	return api.ArticleText{Title: "Titel", Blocks: blocks}
}

func saveNewArticle(t *testing.T, e *Editorial, actor int64, de api.ArticleText) api.EditorArticle {
	t.Helper()
	a, err := e.SaveArticle(context.Background(), nil, actor, api.ArticleInput{Status: "published", De: de})
	if err != nil {
		t.Fatalf("Artikel anlegen: %v", err)
	}
	return a
}

func TestREQ136AC11NeueBausteineUndLayoutsSindGueltig(t *testing.T) {
	e, _, _, _, admin := newArticleTest(t)
	de := api.ArticleText{Title: "Titel", Layout: "magazine", Blocks: []api.ArticleBlock{
		{Kind: "lead", Text: "Einleitung"},
		{Kind: "example", Label: "Beispiel", Text: "Text", Anchor: "bsp"},
		{Kind: "statement", Text: "Kernaussage"},
		{Kind: "outline"},
		{Kind: "section", Eyebrow: "Dachzeile", Text: "Überschrift", Anchor: "teil-1", Blocks: []api.ArticleBlock{{Kind: "paragraph", Text: "Inhalt"}}},
		{Kind: "conclusion", Eyebrow: "Fazit", Text: "Schluss", Blocks: []api.ArticleBlock{{Kind: "paragraph", Text: "Inhalt"}}},
		{Kind: "related", Label: "Weiterlesen", Text: "Ziel", Href: "/de/themen/vibe-coding"},
		{Kind: "quoteheading", Text: "Zitat", Attribution: "Quelle"},
		{Kind: "cta", Text: "Frage", Description: "Text", Label: "Los", Href: "/de/kontakt"},
		{Kind: "image", Src: "/artikelbild-harness.png", Alt: "Grafik", Width: 1685, Height: 542},
	}}
	got := saveNewArticle(t, e, admin.ID, de)
	if !reflect.DeepEqual(got.De, de) {
		t.Fatalf("REQ-136-AC11: gespeicherter Inhalt weicht ab\n erhalten %+v\n erwartet %+v", got.De, de)
	}
}

func TestREQ136UngueltigeInhalteWerdenAbgewiesen(t *testing.T) {
	e, _, _, _, admin := newArticleTest(t)
	p := api.ArticleBlock{Kind: "paragraph", Text: "Inhalt"}
	span := func(s api.ArticleSpan) api.ArticleText {
		return articleText(api.ArticleBlock{Kind: "paragraph", Text: "Hier", Spans: []api.ArticleSpan{s}})
	}
	cases := map[string]api.ArticleText{
		"REQ-136-AC9 Link mit javascript:":           span(api.ArticleSpan{Start: 0, End: 4, Href: "javascript:alert(1)"}),
		"REQ-136-AC9 Link mit //fremd":               span(api.ArticleSpan{Start: 0, End: 4, Href: "//example.org"}),
		"REQ-136-AC9 Verweis ohne Ziel":              articleText(api.ArticleBlock{Kind: "related", Label: "L", Text: "T"}),
		"REQ-136-AC9 Aufruf mit data:":               articleText(api.ArticleBlock{Kind: "cta", Text: "T", Label: "L", Href: "data:text/html,x"}),
		"REQ-136-AC9 Link im Listeneintrag ungültig": articleText(api.ArticleBlock{Kind: "unordered", Items: []api.ArticleEntry{{Title: "Punkt", Spans: []api.ArticleSpan{{Start: 0, End: 5, Href: "ftp://x"}}}}}),
		"REQ-136-AC8 Bereich hinter dem Textende":    span(api.ArticleSpan{Start: 2, End: 9, Bold: true}),
		"REQ-136-AC8 leerer Bereich":                 span(api.ArticleSpan{Start: 2, End: 2, Bold: true}),
		"REQ-136-AC8 überlappende Bereiche": articleText(api.ArticleBlock{Kind: "paragraph", Text: "Hier steht", Spans: []api.ArticleSpan{
			{Start: 0, End: 5, Bold: true}, {Start: 3, End: 8, Italic: true}}}),
		"REQ-136-AC11 Abschnitt ohne Überschrift": articleText(api.ArticleBlock{Kind: "section", Eyebrow: "D", Blocks: []api.ArticleBlock{p}}),
		"REQ-136-AC11 Abschnitt im Abschnitt": articleText(api.ArticleBlock{Kind: "section", Text: "A", Blocks: []api.ArticleBlock{
			{Kind: "section", Text: "B", Blocks: []api.ArticleBlock{p}}}}),
		"REQ-136-AC11 Beispielkasten ohne Text":   articleText(api.ArticleBlock{Kind: "example", Label: "Beispiel"}),
		"REQ-136-AC11 Sprungziel mit Leerzeichen": articleText(api.ArticleBlock{Kind: "section", Text: "A", Anchor: "mein ziel", Blocks: []api.ArticleBlock{p}}),
		"REQ-136-AC11 unbekanntes Layout":         {Title: "Titel", Layout: "poster", Blocks: []api.ArticleBlock{p}},
		"REQ-136-AC10 Bild von fremder Adresse":   articleText(api.ArticleBlock{Kind: "image", Src: "https://example.org/x.png", Alt: "Bild"}),
		"REQ-136-AC10 Bild ohne Alternativtext":   articleText(api.ArticleBlock{Kind: "image", Src: "/artikelbild-harness.png", Alt: " "}),
		"REQ-136-AC10 Bild im Abschnitt ohne Alternativtext": articleText(api.ArticleBlock{Kind: "section", Text: "A", Blocks: []api.ArticleBlock{
			{Kind: "image", Src: "/artikelbild-harness.png"}}}),
	}
	for name, de := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := e.SaveArticle(context.Background(), nil, admin.ID, api.ArticleInput{Status: "draft", De: de})
			var verr *ValidationError
			if !errors.As(err, &verr) || verr.Msg == "" {
				t.Fatalf("muss mit verständlicher Meldung abgewiesen werden, erhalten %v", err)
			}
		})
	}
}

func TestREQ136AC8AC9FormatierungUndZulaessigeLinkzieleBleibenErhalten(t *testing.T) {
	e, _, _, _, admin := newArticleTest(t)
	// „Größe 😀 fett“: Positionen zählen UTF-16-Codeeinheiten, das Emoji belegt zwei. „fett“ steht an 9 bis 13.
	de := articleText(
		api.ArticleBlock{Kind: "paragraph", Text: "Größe 😀 fett", Spans: []api.ArticleSpan{{Start: 9, End: 13, Bold: true, Italic: true, Underline: true}}},
		api.ArticleBlock{Kind: "paragraph", Text: "a b c d", Spans: []api.ArticleSpan{
			{Start: 0, End: 1, Href: "https://example.org/x"}, {Start: 2, End: 3, Href: "http://example.org"},
			{Start: 4, End: 5, Href: "mailto:info@example.org"}, {Start: 6, End: 7, Href: "/de/kontakt"}}},
		api.ArticleBlock{Kind: "ordered", Items: []api.ArticleEntry{{Title: "Punkt", Description: "Mehr",
			Spans: []api.ArticleSpan{{Start: 0, End: 5, Bold: true}}, DescriptionSpans: []api.ArticleSpan{{Start: 0, End: 4, Italic: true}}}}},
	)
	got := saveNewArticle(t, e, admin.ID, de)
	if !reflect.DeepEqual(got.De, de) {
		t.Fatalf("Formatierung weicht ab\n erhalten %+v\n erwartet %+v", got.De, de)
	}
}

func TestREQ136AC15StandFolgtInhaltlichenAenderungenInDeutscherOrtszeit(t *testing.T) {
	e, pub, clock, _, admin := newArticleTest(t)
	ctx := context.Background()
	// 23.11.2026 23:30 UTC ist in Deutschland bereits der 24.11.2026 (MEZ, UTC+1).
	clock.t = time.Date(2026, 11, 23, 23, 30, 0, 0, time.UTC)
	a := saveNewArticle(t, e, admin.ID, articleText(api.ArticleBlock{Kind: "paragraph", Text: "Erste Fassung"}))
	if a.Updated != "2026-11-24" {
		t.Fatalf("Stand beim Anlegen: erhalten %q, erwartet 2026-11-24", a.Updated)
	}
	// REQ-136-AC5: Speichern ohne Änderung lässt den Stand unverändert, auch Tage später.
	clock.t = time.Date(2026, 12, 3, 9, 0, 0, 0, time.UTC)
	same, err := e.SaveArticle(ctx, &a.Id, admin.ID, api.ArticleInput{Status: "published", De: a.De})
	if err != nil || same.Updated != "2026-11-24" {
		t.Fatalf("REQ-136-AC5: Stand nach Speichern ohne Änderung %q (Fehler %v), erwartet 2026-11-24", same.Updated, err)
	}
	// Ein Statuswechsel ist keine inhaltliche Änderung.
	draft, err := e.SaveArticle(ctx, &a.Id, admin.ID, api.ArticleInput{Status: "draft", De: a.De})
	if err != nil || draft.Updated != "2026-11-24" {
		t.Fatalf("Stand nach Statuswechsel %q (Fehler %v), erwartet 2026-11-24", draft.Updated, err)
	}
	next := articleText(api.ArticleBlock{Kind: "paragraph", Text: "Zweite Fassung"})
	changed, err := e.SaveArticle(ctx, &a.Id, admin.ID, api.ArticleInput{Status: "published", De: next})
	if err != nil || changed.Updated != "2026-12-03" {
		t.Fatalf("Stand nach Änderung %q (Fehler %v), erwartet 2026-12-03", changed.Updated, err)
	}
	public, err := pub.Article(ctx, a.Id, DE)
	if err != nil || public.Updated != "2026-12-03" {
		t.Fatalf("öffentlicher Stand %q (Fehler %v), erwartet 2026-12-03", public.Updated, err)
	}
}

func TestREQ136AC1UeberfuehrungLegtBeideArtikelGenauEinmalAn(t *testing.T) {
	e, pub, _, accounts, admin := newArticleTest(t)
	ctx := context.Background()
	author := mustCreate(t, accounts, "autor@example.test", RoleEditor)
	if _, err := accounts.SetDisplayName(ctx, author.ID, "Marvin Jakob"); err != nil {
		t.Fatal(err)
	}
	if err := e.ImportTopicArticles(ctx); err != nil {
		t.Fatalf("Überführung: %v", err)
	}
	list, err := e.Articles(ctx)
	if err != nil || len(list.Items) != 2 {
		t.Fatalf("erwartet zwei Artikel in der Redaktion, erhalten %+v (Fehler %v)", list.Items, err)
	}
	want := map[string]struct{ de, en string }{
		"vibe-coding":         {"Vibe Coding", "Vibe Coding"},
		"softwareentwicklung": {"KI in der Software­entwicklung", "AI in Software Development"},
	}
	ids := map[string]int64{}
	for _, item := range list.Items {
		a, err := e.Article(ctx, item.Id)
		if err != nil {
			t.Fatal(err)
		}
		w, ok := want[a.TopicSlug]
		if !ok || a.De.Title != w.de || a.En == nil || a.En.Title != w.en {
			t.Fatalf("unerwarteter Artikel %q: de %q", a.TopicSlug, a.De.Title)
		}
		if a.Status != "published" || a.Updated != "2026-11-16" || a.AuthorId != author.ID {
			t.Fatalf("%s: Status %q, Stand %q, Autor %d; erwartet veröffentlicht, 2026-11-16, Konto „Marvin Jakob“ (%d, nicht Admin %d)",
				a.TopicSlug, a.Status, a.Updated, a.AuthorId, author.ID, admin.ID)
		}
		ids[a.TopicSlug] = a.Id
	}
	// REQ-136-AC4: über die Themenadresse erreichbar, in der öffentlichen Artikelliste kein zweiter Eintrag.
	for slug, w := range want {
		for lang, title := range map[Lang]string{DE: w.de, EN: w.en} {
			got, err := pub.TopicArticle(ctx, slug, lang)
			if err != nil || got.Content.Title != title || got.AuthorName != "Marvin Jakob" || string(got.Lang) != string(lang) || got.Updated != "2026-11-16" {
				t.Fatalf("Themenadresse %s/%s: Titel %q, Autor %q, Stand %q (Fehler %v)", slug, lang, got.Content.Title, got.AuthorName, got.Updated, err)
			}
		}
	}
	public, err := pub.Articles(ctx, DE)
	if err != nil || len(public.Items) != 0 {
		t.Fatalf("REQ-136-AC4: öffentliche Artikelliste muss leer bleiben, erhalten %+v", public.Items)
	}
	// Zweiter Start nach dem Löschen eines Artikels: keine erneute Anlage.
	if err := e.DeleteArticle(ctx, ids["vibe-coding"]); err != nil {
		t.Fatal(err)
	}
	if err := e.ImportTopicArticles(ctx); err != nil {
		t.Fatal(err)
	}
	if list, _ := e.Articles(ctx); len(list.Items) != 1 {
		t.Fatalf("REQ-136-AC1: nach Löschen und erneutem Start erwartet ein Artikel, erhalten %d", len(list.Items))
	}
	if _, err := pub.TopicArticle(ctx, "vibe-coding", DE); !errors.Is(err, ErrNotFound) {
		t.Fatalf("gelöschter Artikel muss an der Themenadresse fehlen, erhalten %v", err)
	}
	// Ein zurückgenommener Artikel ist an der Themenadresse nicht öffentlich; die Verknüpfung bleibt erhalten.
	sd, _ := e.Article(ctx, ids["softwareentwicklung"])
	if _, err := e.SaveArticle(ctx, &sd.Id, admin.ID, api.ArticleInput{Status: "draft", De: sd.De, En: sd.En}); err != nil {
		t.Fatal(err)
	}
	if _, err := pub.TopicArticle(ctx, "softwareentwicklung", DE); !errors.Is(err, ErrNotFound) {
		t.Fatalf("zurückgenommener Artikel muss an der Themenadresse fehlen, erhalten %v", err)
	}
	if again, _ := e.Article(ctx, sd.Id); again.TopicSlug != "softwareentwicklung" || again.Updated != "2026-11-16" {
		t.Fatalf("REQ-136-AC5: Themenadresse %q und Stand %q müssen beim Speichern erhalten bleiben", again.TopicSlug, again.Updated)
	}
}

func TestREQ136AC1UeberfuehrungWartetAufEinKontoUndNimmtSonstDasAeltesteAdminKonto(t *testing.T) {
	a, db := newAccountsTest(t)
	e := NewEditorial(db)
	ctx := context.Background()
	if err := e.ImportTopicArticles(ctx); err != nil {
		t.Fatalf("ohne Konto darf die Überführung nicht scheitern: %v", err)
	}
	if list, _ := e.Articles(ctx); len(list.Items) != 0 {
		t.Fatalf("ohne Konto darf kein Artikel entstehen, erhalten %d", len(list.Items))
	}
	mustCreate(t, a, "redaktion@example.test", RoleEditor)
	admin := mustCreate(t, a, "admin@example.test", RoleAdmin)
	mustCreate(t, a, "admin2@example.test", RoleAdmin)
	if err := e.ImportTopicArticles(ctx); err != nil {
		t.Fatal(err)
	}
	list, _ := e.Articles(ctx)
	if len(list.Items) != 2 {
		t.Fatalf("nach Anlage eines Kontos erwartet zwei Artikel, erhalten %d", len(list.Items))
	}
	if got, _ := e.Article(ctx, list.Items[0].Id); got.AuthorId != admin.ID {
		t.Fatalf("Autor %d, erwartet ältestes Admin-Konto %d", got.AuthorId, admin.ID)
	}
}

// REQ-136-AC2: Die überführte Fassung nennt die fünf Perspektiven aus Ticket #18 in ihrer Reihenfolge.
func TestREQ136AC2UeberfuehrterArtikelNenntDieFuenfPerspektiven(t *testing.T) {
	e, _, _, _, _ := newArticleTest(t)
	ctx := context.Background()
	if err := e.ImportTopicArticles(ctx); err != nil {
		t.Fatal(err)
	}
	var raw string
	if err := e.db.QueryRowContext(ctx, "SELECT de FROM articles WHERE topic_slug = 'vibe-coding'").Scan(&raw); err != nil {
		t.Fatal(err)
	}
	var vc api.ArticleText
	if err := json.Unmarshal([]byte(raw), &vc); err != nil {
		t.Fatal(err)
	}
	var sections []string
	for _, b := range vc.Blocks {
		if b.Kind == "section" {
			sections = append(sections, b.Eyebrow)
		}
	}
	want := []string{"Prompt Engineering", "Context Engineering", "Harness Engineering", "Specification Engineering", "Product Engineering"}
	if !reflect.DeepEqual(sections, want) || vc.Layout != "magazine" {
		t.Fatalf("Vibe Coding: Abschnitte %v, Layout %q; erwartet %v im Layout magazine", sections, vc.Layout, want)
	}
}
