package service

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"ki-web/backend/internal/store"
)

// Fristgerechte Löschung personenbezogener Eingänge (Ticket #90, Datenschutzerklärung „Kontaktformular“ und
// „Anfrage für ein Beratungsgespräch“). Bestätigte Regeln der verantwortlichen Stelle vom 18.11.2026:
//
//   - Kontaktnachrichten: sechs Kalendermonate ab Eingang.
//   - Beratungsanfragen: sechs Kalendermonate ab der letzten Anfrage; eine erneute Anfrage mit derselben Adresse
//     beginnt die Frist neu (UpsertConsultationRequest setzt requested_at).
//   - Fristende ist derselbe Kalendertag zur selben Uhrzeit in deutscher Zeit, im kürzeren Zielmonat dessen
//     letzter Tag. Fällig ist ein Datensatz 24 Stunden vor dem Fristende. Die Bereinigung läuft beim Start und
//     danach alle 24 Stunden, sie löscht deshalb spätestens zum Fristende.

const (
	// RetentionMonths ist die zugesagte Höchstspeicherdauer in Kalendermonaten.
	RetentionMonths = 6
	// RetentionInterval ist der Abstand der Bereinigungsläufe und zugleich der Vorlauf der Fälligkeit.
	RetentionInterval = 24 * time.Hour
)

// RetentionDeadline liefert das Fristende für einen Eingang zum Zeitpunkt start.
func RetentionDeadline(start time.Time) time.Time {
	s := start.In(StatsZone)
	y, m, d := s.Date()
	ty, tm := y, m+RetentionMonths
	for tm > 12 {
		tm -= 12
		ty++
	}
	if last := time.Date(ty, tm+1, 0, 0, 0, 0, 0, StatsZone).Day(); d > last {
		d = last
	}
	return time.Date(ty, tm, d, s.Hour(), s.Minute(), s.Second(), s.Nanosecond(), StatsZone)
}

// RetentionDue meldet, ob ein Eingang vom Zeitpunkt start zum Zeitpunkt now zu löschen ist.
func RetentionDue(start, now time.Time) bool {
	return !now.Before(RetentionDeadline(start).Add(-RetentionInterval))
}

// retentionCandidatesBefore begrenzt die Vorauswahl in der Datenbank. Fünf Monate liegen sicher vor jeder
// Fälligkeit nach sechs Kalendermonaten abzüglich 24 Stunden.
func retentionCandidatesBefore(now time.Time) string {
	return formatTime(now.AddDate(0, -(RetentionMonths - 1), 0))
}

// DeleteExpired löscht alle fälligen Nachrichten und liefert ihre Anzahl.
func (c *Contact) DeleteExpired(ctx context.Context) (int64, error) {
	now := c.now()
	rows, err := c.q.ListContactMessagesBefore(ctx, retentionCandidatesBefore(now))
	if err != nil {
		return 0, err
	}
	var n int64
	for _, r := range rows {
		if !RetentionDue(parseTime(r.ReceivedAt), now) {
			continue
		}
		deleted, err := c.q.DeleteContactMessage(ctx, r.ID)
		if err != nil {
			return n, err
		}
		n += deleted
	}
	return n, nil
}

// Delete entfernt eine Nachricht sofort, etwa auf Wunsch der absendenden Person. Gibt es sie nicht (mehr),
// liefert es ErrNotFound.
func (c *Contact) Delete(ctx context.Context, id int64) error {
	n, err := c.q.DeleteContactMessage(ctx, id)
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteExpired löscht alle fälligen Anfragen und liefert ihre Anzahl. Eine zwischen Auswahl und Löschung
// erneut gesendete Anfrage bleibt erhalten, weil ihre Frist neu begonnen hat.
func (c *Consultations) DeleteExpired(ctx context.Context) (int64, error) {
	now := c.now()
	rows, err := c.q.ListConsultationRequestsBefore(ctx, retentionCandidatesBefore(now))
	if err != nil {
		return 0, err
	}
	if c.afterSelect != nil {
		c.afterSelect()
	}
	var n int64
	for _, r := range rows {
		if !RetentionDue(parseTime(r.RequestedAt), now) {
			continue
		}
		deleted, err := c.q.DeleteConsultationRequestIfUnchanged(ctx, store.DeleteConsultationRequestIfUnchangedParams{ID: r.ID, RequestedAt: r.RequestedAt})
		if err != nil {
			return n, err
		}
		n += deleted
	}
	return n, nil
}

// Retention führt die fristgerechte Löschung für Kontaktnachrichten und Beratungsanfragen aus.
type Retention struct {
	contact       *Contact
	consultations *Consultations
	log           *slog.Logger
}

// NewRetention erzeugt die Bereinigung.
func NewRetention(contact *Contact, consultations *Consultations, log *slog.Logger) *Retention {
	return &Retention{contact: contact, consultations: consultations, log: log}
}

// RunOnce löscht alle fälligen Datensätze beider Arten. Das Protokoll enthält je Lauf genau einen Eintrag mit
// der Anzahl je Datenart, auch bei null, oder den Fehler; nie Namen, Adressen oder Inhalte.
func (r *Retention) RunOnce(ctx context.Context) error {
	contacts, errContact := r.contact.DeleteExpired(ctx)
	consultations, errConsult := r.consultations.DeleteExpired(ctx)
	if err := errors.Join(errContact, errConsult); err != nil {
		r.log.Error("fristgerechte löschung fehlgeschlagen",
			"kontaktnachrichten", contacts, "beratungsanfragen", consultations, "fehler", err)
		return err
	}
	r.log.Info("fristgerechte löschung abgeschlossen", "kontaktnachrichten", contacts, "beratungsanfragen", consultations)
	return nil
}

// Run löscht beim Aufruf und danach im Abstand interval, bis ctx endet. So holt der Start nach einem Ausfall
// alle inzwischen fälligen Löschungen ohne manuellen Eingriff nach.
func (r *Retention) Run(ctx context.Context, interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		if err := r.RunOnce(ctx); err != nil && ctx.Err() != nil {
			return
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}
