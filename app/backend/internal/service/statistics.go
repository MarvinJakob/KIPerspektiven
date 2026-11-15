package service

import (
	"cmp"
	"context"
	"database/sql"
	"errors"
	"regexp"
	"slices"
	"strings"
	"time"
	_ "time/tzdata" // Europe/Berlin auch ohne Zeitzonendaten im Image oder unter Windows

	"ki-web/backend/internal/auth"
	"ki-web/backend/internal/store"
)

// StatsZone legt fest, wann ein Tag der Statistik beginnt. Tageszähler und Zeiträume gelten für
// Kalendertage in deutscher Zeit, so wie die Redaktion sie liest.
var StatsZone = mustLoadZone("Europe/Berlin")

func mustLoadZone(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return loc
}

const dayLayout = "2006-01-02"

// Period ist ein Auswertungszeitraum der Statistik (Ticket #130).
type Period string

const (
	Last7Days  Period = "7d"
	Last30Days Period = "30d"
	AllTime    Period = "all"
)

// DefaultPeriod ist die Vorauswahl der Statistik.
const DefaultPeriod = Last30Days

// ParsePeriod prüft eine Zeitraumangabe.
func ParsePeriod(s string) (Period, bool) {
	switch p := Period(s); p {
	case Last7Days, Last30Days, AllTime:
		return p, true
	}
	return "", false
}

// days liefert die Zahl der Kalendertage einschließlich heute; 0 bedeutet ohne Begrenzung.
func (p Period) days() int {
	switch p {
	case Last7Days:
		return 7
	case Last30Days:
		return 30
	}
	return 0
}

// ResultsPageSize ist die Zahl der Ergebnisse je Seite in der Statistik.
const ResultsPageSize = 50

// Rating ist der gewählte Reifegrad einer Dimension.
type Rating struct {
	Dimension string
	Level     int
}

// ReadinessResult ist ein gespeichertes Ergebnis der Selbsteinschätzung.
type ReadinessResult struct {
	ID          int64
	Lang        Lang
	SubmittedAt time.Time
	Ratings     []Rating // in Ablaufreihenfolge der Dimensionen
}

// ReadinessResultPage ist eine Seite gespeicherter Ergebnisse, neueste zuerst.
type ReadinessResultPage struct {
	Total int64
	Page  int
	Items []ReadinessResult
}

// resultKeyPattern beschreibt die Kennung eines Ergebnisses: 128 zufällige Bit, hexadezimal.
var resultKeyPattern = regexp.MustCompile(`^[0-9a-f]{32}$`)

// Statistics zählt Seitenaufrufe und speichert Ergebnisse der Selbsteinschätzung (Ticket #130, ADR 0010).
// IP-Pseudonyme enthalten nur den letzten Aufruftag (#142, ADR 0010). Ergebnisse bleiben davon getrennt.
type Statistics struct {
	db         *sql.DB
	q          *store.Queries
	dimensions []string // freigegebene Dimensionen in Ablaufreihenfolge
	maxLevel   int
	now        func() time.Time
	ipKey      []byte
}

// NewStatistics erzeugt den Dienst. dimensions sind die freigegebenen Dimensionen, maxLevel der höchste
// Reifegrad. Beides kommt aus dem Audit-Katalog, den dieses Paket nicht kennen darf (Importzyklus).
func NewStatistics(db *sql.DB, dimensions []string, maxLevel int) *Statistics {
	return &Statistics{db: db, q: store.New(db), dimensions: dimensions, maxLevel: maxLevel, now: time.Now}
}

// firstDay liefert 0:00 Uhr deutscher Zeit am ersten Tag des Zeitraums; ok ist false ohne Begrenzung.
func (s *Statistics) firstDay(p Period) (start time.Time, ok bool) {
	n := p.days()
	if n == 0 {
		return time.Time{}, false
	}
	y, m, d := s.now().In(StatsZone).Date()
	return time.Date(y, m, d-(n-1), 0, 0, 0, 0, StatsZone), true
}

// SaveReadinessResult speichert ein vollständiges Ergebnis oder aktualisiert das Ergebnis mit derselben
// Kennung. Ein unverändert erneut gesendetes Ergebnis ändert nichts, auch nicht den Zeitpunkt.
// Gespeichert wird nur der Hash der Kennung, wie bei Sitzungen.
func (s *Statistics) SaveReadinessResult(ctx context.Context, key string, lang Lang, ratings []Rating) error {
	if !resultKeyPattern.MatchString(key) {
		return invalid("Die Kennung des Ergebnisses ist ungültig.")
	}
	if _, ok := ParseLang(string(lang)); !ok {
		return invalid("Unbekannte Sprache. Erlaubt sind de und en.")
	}
	ordered, err := s.complete(ratings)
	if err != nil {
		return err
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	q := s.q.WithTx(tx)
	now := s.now().UTC().Format(time.RFC3339)
	keyHash := auth.HashToken(key)

	cur, err := q.GetReadinessResultByKey(ctx, keyHash)
	var id int64
	switch {
	case errors.Is(err, sql.ErrNoRows):
		id, err = q.CreateReadinessResult(ctx, store.CreateReadinessResultParams{
			KeyHash: keyHash, Lang: string(lang), SubmittedAt: now,
		})
		if err != nil {
			return err
		}
	case err != nil:
		return err
	default:
		id = cur.ID
		stored, err := q.ListReadinessRatings(ctx, []int64{id})
		if err != nil {
			return err
		}
		if cur.Lang == string(lang) && sameRatings(stored, ordered) {
			return nil
		}
		if err := q.UpdateReadinessResult(ctx, store.UpdateReadinessResultParams{Lang: string(lang), SubmittedAt: now, ID: id}); err != nil {
			return err
		}
		if err := q.DeleteReadinessRatings(ctx, id); err != nil {
			return err
		}
	}
	for _, r := range ordered {
		if err := q.InsertReadinessRating(ctx, store.InsertReadinessRatingParams{
			ResultID: id, Dimension: r.Dimension, Level: int64(r.Level),
		}); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// complete prüft, dass jede freigegebene Dimension genau einmal mit einem gültigen Reifegrad bewertet ist,
// und liefert die Bewertungen in Ablaufreihenfolge.
func (s *Statistics) complete(ratings []Rating) ([]Rating, error) {
	levels := make(map[string]int, len(ratings))
	for _, r := range ratings {
		if !slices.Contains(s.dimensions, r.Dimension) {
			return nil, invalid("Die Dimension „%s“ ist unbekannt oder nicht freigegeben.", r.Dimension)
		}
		if _, dup := levels[r.Dimension]; dup {
			return nil, invalid("Die Dimension „%s“ ist mehrfach bewertet.", r.Dimension)
		}
		if r.Level < 1 || r.Level > s.maxLevel {
			return nil, invalid("Reifegrade liegen zwischen 1 und %d.", s.maxLevel)
		}
		levels[r.Dimension] = r.Level
	}
	if len(levels) != len(s.dimensions) {
		return nil, invalid("Das Ergebnis ist unvollständig: Jede Dimension braucht genau einen Reifegrad.")
	}
	out := make([]Rating, 0, len(s.dimensions))
	for _, d := range s.dimensions {
		out = append(out, Rating{Dimension: d, Level: levels[d]})
	}
	return out, nil
}

func sameRatings(stored []store.ReadinessResultRating, want []Rating) bool {
	if len(stored) != len(want) {
		return false
	}
	levels := make(map[string]int64, len(stored))
	for _, r := range stored {
		levels[r.Dimension] = r.Level
	}
	for _, r := range want {
		if l, ok := levels[r.Dimension]; !ok || l != int64(r.Level) {
			return false
		}
	}
	return true
}

// DeleteReadinessResult löscht das Ergebnis mit dieser Kennung, wenn es eines gibt.
func (s *Statistics) DeleteReadinessResult(ctx context.Context, key string) error {
	if !resultKeyPattern.MatchString(key) {
		return invalid("Die Kennung des Ergebnisses ist ungültig.")
	}
	return s.q.DeleteReadinessResultByKey(ctx, auth.HashToken(key))
}

// ReadinessResults liefert die Anzahl der Ergebnisse im Zeitraum und eine Seite davon, neueste zuerst.
// Seiten beginnen bei 1; kleinere Werte gelten als 1.
func (s *Statistics) ReadinessResults(ctx context.Context, p Period, page int) (ReadinessResultPage, error) {
	page = max(page, 1)
	since := ""
	if start, ok := s.firstDay(p); ok {
		// Zeitpunkte sind RFC 3339 in UTC ohne Sekundenbruchteile; der Textvergleich entspricht der Zeitfolge.
		since = start.UTC().Format(time.RFC3339)
	}
	total, err := s.q.CountReadinessResults(ctx, since)
	if err != nil {
		return ReadinessResultPage{}, err
	}
	rows, err := s.q.ListReadinessResults(ctx, store.ListReadinessResultsParams{
		Since: since, PageSize: ResultsPageSize, Skip: int64(page-1) * ResultsPageSize,
	})
	if err != nil {
		return ReadinessResultPage{}, err
	}
	out := ReadinessResultPage{Total: total, Page: page, Items: make([]ReadinessResult, 0, len(rows))}
	if len(rows) == 0 {
		return out, nil
	}
	ids := make([]int64, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.ID)
	}
	ratings, err := s.q.ListReadinessRatings(ctx, ids)
	if err != nil {
		return ReadinessResultPage{}, err
	}
	byResult := make(map[int64][]Rating, len(rows))
	for _, r := range ratings {
		byResult[r.ResultID] = append(byResult[r.ResultID], Rating{Dimension: r.Dimension, Level: int(r.Level)})
	}
	for _, r := range rows {
		at, err := time.Parse(time.RFC3339, r.SubmittedAt)
		if err != nil {
			return ReadinessResultPage{}, err
		}
		rs := byResult[r.ID]
		s.sortRatings(rs)
		out.Items = append(out.Items, ReadinessResult{ID: r.ID, Lang: Lang(r.Lang), SubmittedAt: at, Ratings: rs})
	}
	return out, nil
}

// sortRatings ordnet Bewertungen in Ablaufreihenfolge. Dimensionen, die inzwischen nicht mehr freigegeben
// sind, folgen alphabetisch am Ende, damit ältere Ergebnisse vollständig sichtbar bleiben.
func (s *Statistics) sortRatings(rs []Rating) {
	pos := func(d string) int {
		if i := slices.Index(s.dimensions, d); i >= 0 {
			return i
		}
		return len(s.dimensions)
	}
	slices.SortFunc(rs, func(a, b Rating) int {
		return cmp.Or(cmp.Compare(pos(a.Dimension), pos(b.Dimension)), strings.Compare(a.Dimension, b.Dimension))
	})
}
