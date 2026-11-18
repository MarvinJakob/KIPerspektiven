package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"ki-web/backend/internal/linkedin"
	"ki-web/backend/internal/store"
)

// Unit-Tests zu Ticket #85 (Beiträge automatisch auf LinkedIn teilen) gegen eine echte SQLite-Datenbank und ein
// LinkedIn-Testdouble. Sollwerte aus der Spezifikation REQ-85-AC1 bis REQ-85-AC13.

const (
	testBaseURL  = "https://ki.example.test"
	linkedToken  = "geheimes-token-85"
	linkedMember = "abc123"
)

// fakeLinkedIn zeichnet angelegte Posts auf und liefert vorgegebene Antworten.
type fakeLinkedIn struct {
	mu         sync.Mutex
	configured bool
	posts      []linkedin.Post
	tokens     []string
	err        error // Antwort für den nächsten und alle weiteren Aufrufe
}

func (f *fakeLinkedIn) Configured() bool { return f.configured }

func (f *fakeLinkedIn) CreatePost(_ context.Context, token string, p linkedin.Post) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.tokens = append(f.tokens, token)
	if f.err != nil {
		if errors.Is(f.err, linkedin.ErrUnknownOutcome) {
			f.posts = append(f.posts, p) // LinkedIn hat den Post angelegt, die Antwort ging verloren
		}
		return "", f.err
	}
	f.posts = append(f.posts, p)
	return fmt.Sprintf("urn:li:share:%d", len(f.posts)), nil
}

func (f *fakeLinkedIn) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.posts)
}

type socialTest struct {
	t     *testing.T
	ctx   context.Context
	db    *sql.DB
	ed    *Editorial
	so    *Social
	li    *fakeLinkedIn
	clock time.Time
}

func newSocialTest(t *testing.T) *socialTest {
	t.Helper()
	db, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := store.Migrate(context.Background(), db, false, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatal(err)
	}
	st := &socialTest{t: t, ctx: context.Background(), db: db, li: &fakeLinkedIn{configured: true},
		clock: time.Date(2026, 11, 18, 10, 0, 0, 0, time.UTC)}
	now := func() time.Time { return st.clock }
	st.ed = NewEditorial(db)
	st.ed.now = now
	st.so = NewSocial(db, st.li, testBaseURL)
	st.so.now = now
	st.ed.SetFirstPublicationHook(st.so.OnFirstPublication)
	return st
}

// connect verbindet das Profil und schaltet die automatische Veröffentlichung mit Sprache lang ein.
func (st *socialTest) connect(lang Lang) {
	st.t.Helper()
	if err := st.so.ConnectLinkedIn(st.ctx, linkedMember, "Marvin Jakob", linkedToken, st.clock.Add(60*24*time.Hour)); err != nil {
		st.t.Fatal(err)
	}
	if _, err := st.so.UpdateLinkedIn(st.ctx, true, lang); err != nil {
		st.t.Fatal(err)
	}
}

func full(lang Lang, tag string) PostText {
	return PostText{Lang: lang, Title: "Titel " + string(lang) + " " + tag, Summary: "Kurztext " + tag, BodyMarkdown: "Text " + tag}
}

func (st *socialTest) draft(texts ...PostText) EditorPost {
	st.t.Helper()
	p, err := st.ed.Create(st.ctx, PostInput{Texts: texts})
	if err != nil {
		st.t.Fatal(err)
	}
	return p
}

func (st *socialTest) publish(id int64) EditorPost {
	st.t.Helper()
	p, err := st.ed.Publish(st.ctx, id)
	if err != nil {
		st.t.Fatal(err)
	}
	return p
}

func (st *socialTest) send() {
	st.t.Helper()
	if _, err := st.so.SendPending(st.ctx); err != nil {
		st.t.Fatal(err)
	}
}

func (st *socialTest) share(id int64) *Share {
	st.t.Helper()
	s, err := st.so.Share(st.ctx, id)
	if err != nil {
		st.t.Fatal(err)
	}
	return s
}

func TestREQ85AC1EinstellungenBleibenGespeichert(t *testing.T) {
	st := newSocialTest(t)
	s, err := st.so.LinkedIn(st.ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !s.AppConfigured || s.Connected || s.Enabled || s.PreferredLang != DE {
		t.Errorf("Ausgangszustand %+v, erwartet konfiguriert, nicht verbunden, aus, Deutsch", s)
	}
	st.connect(EN)
	s, err = st.so.LinkedIn(st.ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !s.Connected || s.Expired || !s.Enabled || s.PreferredLang != EN || s.ProfileName != "Marvin Jakob" {
		t.Errorf("gespeicherter Zustand %+v", s)
	}
	if s.ExpiresAt == nil || !s.ExpiresAt.Equal(st.clock.Add(60*24*time.Hour)) {
		t.Errorf("Ablauf %v", s.ExpiresAt)
	}
	if _, err := st.so.UpdateLinkedIn(st.ctx, false, DE); err != nil {
		t.Fatal(err)
	}
	if s, _ = st.so.LinkedIn(st.ctx); s.Enabled || s.PreferredLang != DE || !s.Connected {
		t.Errorf("nach Ausschalten %+v", s)
	}
}

func TestREQ85AC2EinschaltenOhneGueltigeVerbindungAbgelehnt(t *testing.T) {
	t.Run("nicht verbunden", func(t *testing.T) {
		st := newSocialTest(t)
		_, err := st.so.UpdateLinkedIn(st.ctx, true, DE)
		var v *ValidationError
		if !errors.As(err, &v) || !strings.Contains(v.Msg, "verbunden") {
			t.Errorf("Fehler %v, erwartet Hinweis auf fehlende Verbindung", err)
		}
		if s, _ := st.so.LinkedIn(st.ctx); s.Enabled {
			t.Error("Zustand muss aus bleiben")
		}
	})
	t.Run("App nicht konfiguriert", func(t *testing.T) {
		st := newSocialTest(t)
		st.li.configured = false
		_ = st.so.ConnectLinkedIn(st.ctx, linkedMember, "M", linkedToken, st.clock.Add(time.Hour))
		_, err := st.so.UpdateLinkedIn(st.ctx, true, DE)
		var v *ValidationError
		if !errors.As(err, &v) || !strings.Contains(v.Msg, "LINKEDIN_CLIENT_ID") {
			t.Errorf("Fehler %v, erwartet Hinweis auf fehlende App-Konfiguration", err)
		}
	})
	t.Run("Autorisierung abgelaufen", func(t *testing.T) {
		st := newSocialTest(t)
		_ = st.so.ConnectLinkedIn(st.ctx, linkedMember, "M", linkedToken, st.clock.Add(-time.Minute))
		_, err := st.so.UpdateLinkedIn(st.ctx, true, DE)
		var v *ValidationError
		if !errors.As(err, &v) || !strings.Contains(v.Msg, "abgelaufen") {
			t.Errorf("Fehler %v, erwartet Hinweis auf abgelaufene Autorisierung", err)
		}
		if s, _ := st.so.LinkedIn(st.ctx); !s.Expired || s.Enabled {
			t.Errorf("Zustand %+v, erwartet abgelaufen und aus", s)
		}
	})
	t.Run("Trennen schaltet aus", func(t *testing.T) {
		st := newSocialTest(t)
		st.connect(DE)
		if err := st.so.DisconnectLinkedIn(st.ctx); err != nil {
			t.Fatal(err)
		}
		if s, _ := st.so.LinkedIn(st.ctx); s.Connected || s.Enabled || s.ProfileName != "" {
			t.Errorf("nach Trennen %+v", s)
		}
	})
}

func TestREQ85AC6SofortigeErstveroeffentlichungTeiltGenauEinmal(t *testing.T) {
	st := newSocialTest(t)
	st.connect(DE)
	p := st.draft(full(DE, "a"), full(EN, "a"))
	st.publish(p.ID)
	if s := st.share(p.ID); s == nil || s.State != SharePending {
		t.Fatalf("Status nach Veröffentlichung %+v, erwartet „wird gesendet“", s)
	}
	st.send()
	st.send() // ein zweiter Lauf darf nichts erneut senden
	if st.li.count() != 1 {
		t.Fatalf("%d Posts, erwartet genau 1", st.li.count())
	}
	got := st.li.posts[0]
	if got.AuthorID != linkedMember || got.Title != "Titel de a" || got.URL != testBaseURL+"/de/blog/"+p.Slug {
		t.Errorf("Post %+v", got)
	}
	if st.li.tokens[0] != linkedToken {
		t.Error("Post muss mit dem gespeicherten Token gesendet werden")
	}
}

func TestREQ85AC7SprachwahlMitRueckfall(t *testing.T) {
	st := newSocialTest(t)
	st.connect(EN)
	both := st.draft(full(DE, "b"), full(EN, "b"))
	onlyDE := st.draft(full(DE, "c"))
	st.publish(both.ID)
	st.publish(onlyDE.ID)
	st.send()
	want := map[string]string{
		"Titel en b": testBaseURL + "/en/blog/" + both.Slug,
		"Titel de c": testBaseURL + "/de/blog/" + onlyDE.Slug,
	}
	if st.li.count() != 2 {
		t.Fatalf("%d Posts, erwartet 2", st.li.count())
	}
	for _, p := range st.li.posts {
		if want[p.Title] != p.URL {
			t.Errorf("Post %q mit Link %q, erwartet %q", p.Title, p.URL, want[p.Title])
		}
	}
	if s := st.share(both.ID); s.Lang != EN {
		t.Errorf("Sprache %q, erwartet en", s.Lang)
	}
}

func TestREQ85AC8ErfolgMitLinkZumPost(t *testing.T) {
	st := newSocialTest(t)
	st.connect(DE)
	p := st.draft(full(DE, "d"))
	st.publish(p.ID)
	st.send()
	s := st.share(p.ID)
	if s.State != ShareSucceeded || s.PostURL != "https://www.linkedin.com/feed/update/urn:li:share:1/" {
		t.Errorf("Status %+v, erwartet geteilt mit Link", s)
	}
	ep, err := st.ed.Post(st.ctx, p.ID)
	if err != nil {
		t.Fatal(err)
	}
	if ep.LinkedIn == nil || ep.LinkedIn.State != ShareSucceeded {
		t.Errorf("Editor-Beitrag ohne LinkedIn-Status: %+v", ep.LinkedIn)
	}
}

func TestREQ85AC9GeplanteVeroeffentlichung(t *testing.T) {
	st := newSocialTest(t)
	st.connect(DE)
	due := st.draft(full(DE, "e"))
	moved := st.draft(full(DE, "f"))
	cancelled := st.draft(full(DE, "g"))
	t1 := st.clock.Add(10 * time.Minute)
	for _, p := range []EditorPost{due, moved, cancelled} {
		if _, err := st.ed.Schedule(st.ctx, p.ID, t1); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := st.ed.Schedule(st.ctx, moved.ID, t1.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if _, err := st.ed.Unschedule(st.ctx, cancelled.ID); err != nil {
		t.Fatal(err)
	}
	// Vor dem Termin: nichts
	st.clock = t1.Add(-time.Second)
	if _, _, err := st.ed.PublishDue(st.ctx); err != nil {
		t.Fatal(err)
	}
	st.send()
	if st.li.count() != 0 || st.share(due.ID) != nil {
		t.Fatalf("vor dem Termin %d Posts", st.li.count())
	}
	// Zum ersten Termin: nur der fällige Beitrag
	st.clock = t1
	if _, _, err := st.ed.PublishDue(st.ctx); err != nil {
		t.Fatal(err)
	}
	st.send()
	if st.li.count() != 1 || st.li.posts[0].Title != "Titel de e" {
		t.Fatalf("zum Termin %d Posts, erwartet nur den fälligen Beitrag", st.li.count())
	}
	if st.share(moved.ID) != nil || st.share(cancelled.ID) != nil {
		t.Error("verschobener oder aufgehobener Termin darf zum früheren Zeitpunkt nichts auslösen")
	}
	// Verschobener Termin teilt erst zu seinem neuen Zeitpunkt
	st.clock = t1.Add(time.Hour)
	if _, _, err := st.ed.PublishDue(st.ctx); err != nil {
		t.Fatal(err)
	}
	st.send()
	if st.li.count() != 2 || st.share(cancelled.ID) != nil {
		t.Errorf("%d Posts nach verschobenem Termin, erwartet 2 und keinen für den aufgehobenen", st.li.count())
	}
}

func TestREQ85AC10KeinPostOhneErstveroeffentlichungMitAktiverVerbindung(t *testing.T) {
	t.Run("Entwurf speichern und Termin setzen", func(t *testing.T) {
		st := newSocialTest(t)
		st.connect(DE)
		p := st.draft(full(DE, "h"))
		if _, err := st.ed.Update(st.ctx, p.ID, PostInput{Texts: []PostText{full(DE, "h2")}}); err != nil {
			t.Fatal(err)
		}
		if _, err := st.ed.Schedule(st.ctx, p.ID, st.clock.Add(time.Hour)); err != nil {
			t.Fatal(err)
		}
		st.send()
		if st.li.count() != 0 || st.share(p.ID) != nil {
			t.Error("Entwurf oder Termin darf nichts teilen")
		}
	})
	t.Run("Veröffentlichung abgelehnt", func(t *testing.T) {
		st := newSocialTest(t)
		st.connect(DE)
		p := st.draft(PostText{Lang: DE, Title: "Nur Titel"})
		if _, err := st.ed.Publish(st.ctx, p.ID); err == nil {
			t.Fatal("unvollständiger Beitrag darf nicht veröffentlicht werden")
		}
		st.send()
		if st.li.count() != 0 || st.share(p.ID) != nil {
			t.Error("abgelehnte Veröffentlichung darf nichts teilen")
		}
	})
	t.Run("ausgeschaltet", func(t *testing.T) {
		st := newSocialTest(t)
		st.connect(DE)
		if _, err := st.so.UpdateLinkedIn(st.ctx, false, DE); err != nil {
			t.Fatal(err)
		}
		p := st.draft(full(DE, "i"))
		st.publish(p.ID)
		st.send()
		if st.li.count() != 0 || st.share(p.ID) != nil {
			t.Error("ausgeschaltete Veröffentlichung darf nichts teilen")
		}
	})
	t.Run("nicht eingerichtet", func(t *testing.T) {
		st := newSocialTest(t)
		p := st.draft(full(DE, "j"))
		st.publish(p.ID)
		st.send()
		if st.li.count() != 0 || st.share(p.ID) != nil {
			t.Error("ohne Einrichtung darf nichts geteilt werden")
		}
	})
}

func TestREQ85AC11BestehendeBeitraegeNichtErneutTeilen(t *testing.T) {
	st := newSocialTest(t)
	old := st.draft(full(DE, "k")) // vor dem Einschalten veröffentlicht
	st.publish(old.ID)
	st.connect(DE)
	st.send()
	if st.li.count() != 0 {
		t.Fatal("Einschalten darf bestehende Beiträge nicht nachträglich teilen")
	}
	shared := st.draft(full(DE, "l"))
	st.publish(shared.ID)
	st.send()
	if st.li.count() != 1 {
		t.Fatalf("%d Posts, erwartet 1", st.li.count())
	}
	for _, p := range []EditorPost{old, shared} {
		if _, err := st.ed.Update(st.ctx, p.ID, PostInput{Texts: []PostText{full(DE, "geaendert")}}); err != nil {
			t.Fatal(err)
		}
		if _, err := st.ed.Unpublish(st.ctx, p.ID); err != nil {
			t.Fatal(err)
		}
		st.publish(p.ID)
		// erneut zurücknehmen und geplant wieder veröffentlichen
		if _, err := st.ed.Unpublish(st.ctx, p.ID); err != nil {
			t.Fatal(err)
		}
		if _, err := st.ed.Schedule(st.ctx, p.ID, st.clock.Add(time.Minute)); err != nil {
			t.Fatal(err)
		}
	}
	st.clock = st.clock.Add(time.Minute)
	if _, _, err := st.ed.PublishDue(st.ctx); err != nil {
		t.Fatal(err)
	}
	st.send()
	if st.li.count() != 1 {
		t.Errorf("%d Posts nach Ändern, Zurücknehmen und erneutem Veröffentlichen, erwartet weiterhin 1", st.li.count())
	}
	if st.share(old.ID) != nil {
		t.Error("vor dem Einschalten veröffentlichter Beitrag darf keinen LinkedIn-Status erhalten")
	}
}

func TestREQ85AC12AblehnungSichtbarUndWiederholbar(t *testing.T) {
	st := newSocialTest(t)
	st.connect(DE)
	st.li.err = &linkedin.RejectedError{Status: 401}
	p := st.draft(full(DE, "m"))
	st.publish(p.ID)
	st.send()
	s := st.share(p.ID)
	if s.State != ShareFailed || !strings.Contains(s.Message, "abgelaufen") || !strings.Contains(s.Message, "Einstellungen") {
		t.Errorf("Status %+v, erwartet Fehler mit Hinweis auf abgelaufene Autorisierung und Abhilfe", s)
	}
	ep, _ := st.ed.Post(st.ctx, p.ID)
	if ep.Status != StatusPublished {
		t.Error("der Beitrag muss auf der Website veröffentlicht bleiben")
	}
	st.send()
	if len(st.li.tokens) != 1 {
		t.Errorf("%d Versuche, ein fehlgeschlagener Versand darf nicht automatisch wiederholt werden", len(st.li.tokens))
	}
	st.li.err = nil
	if _, err := st.so.Retry(st.ctx, p.ID); err != nil {
		t.Fatal(err)
	}
	st.send()
	if s := st.share(p.ID); s.State != ShareSucceeded || st.li.count() != 1 {
		t.Errorf("nach Wiederholung %+v mit %d Posts, erwartet geteilt und genau 1 Post", s, st.li.count())
	}
	if _, err := st.so.Retry(st.ctx, p.ID); err == nil {
		t.Error("ein geteilter Beitrag darf nicht erneut gesendet werden")
	}
}

func TestREQ85AC12FehlermeldungenJeStatus(t *testing.T) {
	cases := map[int]string{401: "abgelaufen", 403: "Berechtigung", 429: "später", 422: "abgelehnt"}
	for status, want := range cases {
		st := newSocialTest(t)
		st.connect(DE)
		st.li.err = &linkedin.RejectedError{Status: status}
		p := st.draft(full(DE, "n"))
		st.publish(p.ID)
		st.send()
		if s := st.share(p.ID); s.State != ShareFailed || !strings.Contains(s.Message, want) {
			t.Errorf("Status %d: %+v, erwartet Hinweis mit %q", status, s, want)
		}
	}
}

func TestREQ85AC12AbgelaufeneAutorisierungOhneAufruf(t *testing.T) {
	st := newSocialTest(t)
	st.connect(DE)
	p := st.draft(full(DE, "o"))
	st.publish(p.ID)
	st.clock = st.clock.Add(61 * 24 * time.Hour)
	st.send()
	if len(st.li.tokens) != 0 {
		t.Error("mit abgelaufener Autorisierung darf LinkedIn nicht aufgerufen werden")
	}
	if s := st.share(p.ID); s.State != ShareFailed || !strings.Contains(s.Message, "abgelaufen") {
		t.Errorf("Status %+v", s)
	}
}

func TestREQ85AC13UnklarerAusgangOhneWiederholung(t *testing.T) {
	st := newSocialTest(t)
	st.connect(DE)
	st.li.err = fmt.Errorf("zeitüberschreitung: %w", linkedin.ErrUnknownOutcome)
	p := st.draft(full(DE, "p"))
	st.publish(p.ID)
	st.send()
	s := st.share(p.ID)
	if s.State != ShareUnknown || !strings.Contains(s.Message, "prüfen") {
		t.Errorf("Status %+v, erwartet unklaren Ausgang mit Prüfhinweis", s)
	}
	st.li.err = nil
	if _, err := st.so.Retry(st.ctx, p.ID); err == nil {
		t.Error("bei unklarem Ausgang darf keine Wiederholung möglich sein")
	}
	st.send()
	if st.li.count() != 1 {
		t.Errorf("%d Posts, erwartet nur den ersten", st.li.count())
	}
}

func TestREQ85AC13NeustartWaehrendDesSendens(t *testing.T) {
	st := newSocialTest(t)
	st.connect(DE)
	p := st.draft(full(DE, "q"))
	st.publish(p.ID)
	if _, err := st.db.Exec(`UPDATE social_shares SET status = 'sending' WHERE post_id = ?`, p.ID); err != nil {
		t.Fatal(err)
	}
	n, err := st.so.RecoverInterrupted(st.ctx)
	if err != nil || n != 1 {
		t.Fatalf("RecoverInterrupted = %d, %v", n, err)
	}
	st.send()
	if s := st.share(p.ID); s.State != ShareUnknown || st.li.count() != 0 {
		t.Errorf("Status %+v mit %d Posts, erwartet unklar ohne erneuten Versand", s, st.li.count())
	}
}

func TestREQ85AC5HinweiseOhneTokenOderRohantwort(t *testing.T) {
	st := newSocialTest(t)
	st.connect(DE)
	st.li.err = fmt.Errorf("antwort %s: %w", linkedToken, &linkedin.RejectedError{Status: 400})
	p := st.draft(full(DE, "r"))
	st.publish(p.ID)
	st.send()
	s := st.share(p.ID)
	if s.State != ShareFailed || strings.Contains(s.Message, linkedToken) || strings.Contains(s.Message, "antwort") {
		t.Errorf("Hinweis %q enthält Token oder Rohantwort", s.Message)
	}
	settings, _ := st.so.LinkedIn(st.ctx)
	if strings.Contains(fmt.Sprintf("%+v", settings), linkedToken) {
		t.Error("Einstellungen enthalten das Token")
	}
}

func TestREQ85AC6GeloeschterBeitragOhneVersand(t *testing.T) {
	st := newSocialTest(t)
	st.connect(DE)
	p := st.draft(full(DE, "s"))
	st.publish(p.ID)
	if _, err := st.ed.Delete(st.ctx, p.ID); err != nil {
		t.Fatal(err)
	}
	st.send()
	if st.li.count() != 0 {
		t.Error("ein vor dem Versand gelöschter Beitrag darf nicht geteilt werden")
	}
}
