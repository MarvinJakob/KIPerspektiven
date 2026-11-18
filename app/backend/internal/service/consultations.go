package service

import (
	"context"
	"database/sql"
	"time"

	"ki-web/backend/internal/store"
)

// ConsultationRequest ist eine Anfrage für ein kostenloses Beratungsgespräch.
type ConsultationRequest struct {
	ID          int64
	Email       string
	Lang        Lang // Sprache der Seite, in der die Antwort erwartet wird
	RequestedAt time.Time
}

// Consultations nimmt Anfragen für ein kostenloses Beratungsgespräch nach der Selbsteinschätzung an und stellt
// sie der Redaktion bereit (Ticket #136, ADR 0011). Gespeichert werden nur E-Mail-Adresse, Sprache und
// Zeitpunkt. Die Redaktion löscht eine Anfrage, sobald der Termin abgestimmt ist; spätestens sechs Monate nach
// der letzten Anfrage löscht die Anwendung sie automatisch (Ticket #90, retention.go).
type Consultations struct {
	q   *store.Queries
	now func() time.Time

	// afterSelect läuft in Tests zwischen Auswahl und Löschung fälliger Anfragen (Ticket #90).
	afterSelect func()
}

// NewConsultations erzeugt den Dienst.
func NewConsultations(db *sql.DB) *Consultations {
	return &Consultations{q: store.New(db), now: time.Now}
}

// Request speichert eine Anfrage. Eine erneute Anfrage mit derselben Adresse legt keinen zweiten Eintrag an,
// sondern aktualisiert Sprache und Zeitpunkt; so bleibt ein erneutes Senden nach einem Netzfehler folgenlos.
func (c *Consultations) Request(ctx context.Context, email string, lang Lang) error {
	email = NormalizeEmail(email)
	if email == "" {
		return invalid("Bitte eine E-Mail-Adresse angeben.")
	}
	if err := validateEmail(email); err != nil {
		return err
	}
	if _, ok := ParseLang(string(lang)); !ok {
		return invalid("Unbekannte Sprache. Erlaubt sind de und en.")
	}
	return c.q.UpsertConsultationRequest(ctx, store.UpsertConsultationRequestParams{
		Email: email, Lang: string(lang), RequestedAt: formatTime(c.now()),
	})
}

// List liefert alle offenen Anfragen, neueste zuerst.
func (c *Consultations) List(ctx context.Context) ([]ConsultationRequest, error) {
	rows, err := c.q.ListConsultationRequests(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]ConsultationRequest, 0, len(rows))
	for _, r := range rows {
		out = append(out, ConsultationRequest{ID: r.ID, Email: r.Email, Lang: Lang(r.Lang), RequestedAt: parseTime(r.RequestedAt)})
	}
	return out, nil
}

// Delete entfernt eine erledigte Anfrage. Gibt es sie nicht (mehr), liefert es ErrNotFound.
func (c *Consultations) Delete(ctx context.Context, id int64) error {
	n, err := c.q.DeleteConsultationRequest(ctx, id)
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
