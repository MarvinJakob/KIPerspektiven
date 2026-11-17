package service

import (
	"context"
	"database/sql"
	"strings"
	"time"
	"unicode/utf8"

	"ki-web/backend/internal/store"
)

// Höchstlängen der Angaben auf der Kontaktseite in Zeichen (Anforderung #4, api/openapi.yaml).
const (
	MaxContactNameLength    = 200
	MaxContactCompanyLength = 200
	MaxContactMessageLength = 5000
)

// ContactInput ist eine Nachricht, wie sie die Kontaktseite sendet.
type ContactInput struct {
	Name    string
	Company string // optional
	Email   string
	Message string
	Lang    Lang // Sprache der Seite, auf der die Nachricht geschrieben wurde
}

// ContactMessage ist eine gespeicherte Nachricht der Kontaktseite.
type ContactMessage struct {
	ID         int64
	Name       string
	Company    string
	Email      string
	Message    string
	Lang       Lang
	ReceivedAt time.Time
}

// Contact nimmt Nachrichten der öffentlichen Kontaktseite an und stellt sie der Redaktion bereit
// (Anforderung #4). Einsehbar sind sie nur über die Redaktions-API mit Rolle editor oder admin.
type Contact struct {
	q   *store.Queries
	now func() time.Time
}

// NewContact erzeugt den Dienst.
func NewContact(db *sql.DB) *Contact {
	return &Contact{q: store.New(db), now: time.Now}
}

// Send prüft und speichert eine Nachricht. Name, E-Mail-Adresse und Nachricht sind Pflicht; das Unternehmen
// ist optional. Ungültige Angaben ergeben einen *ValidationError.
func (c *Contact) Send(ctx context.Context, in ContactInput) error {
	name := strings.TrimSpace(in.Name)
	company := strings.TrimSpace(in.Company)
	message := strings.TrimSpace(in.Message)
	email := NormalizeEmail(in.Email)
	switch {
	case name == "":
		return invalid("Bitte einen Namen angeben.")
	case utf8.RuneCountInString(name) > MaxContactNameLength:
		return invalid("Der Name darf höchstens %d Zeichen lang sein.", MaxContactNameLength)
	case utf8.RuneCountInString(company) > MaxContactCompanyLength:
		return invalid("Das Unternehmen darf höchstens %d Zeichen lang sein.", MaxContactCompanyLength)
	case email == "":
		return invalid("Bitte eine E-Mail-Adresse angeben.")
	case message == "":
		return invalid("Bitte eine Nachricht eingeben.")
	case utf8.RuneCountInString(message) > MaxContactMessageLength:
		return invalid("Die Nachricht darf höchstens %d Zeichen lang sein.", MaxContactMessageLength)
	}
	if err := validateEmail(email); err != nil {
		return err
	}
	if _, ok := ParseLang(string(in.Lang)); !ok {
		return invalid("Unbekannte Sprache. Erlaubt sind de und en.")
	}
	return c.q.InsertContactMessage(ctx, store.InsertContactMessageParams{
		Name: name, Company: company, Email: email, Message: message, Lang: string(in.Lang),
		ReceivedAt: formatTime(c.now()),
	})
}

// List liefert alle Nachrichten, neueste zuerst.
func (c *Contact) List(ctx context.Context) ([]ContactMessage, error) {
	rows, err := c.q.ListContactMessages(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]ContactMessage, 0, len(rows))
	for _, r := range rows {
		out = append(out, ContactMessage{
			ID: r.ID, Name: r.Name, Company: r.Company, Email: r.Email, Message: r.Message,
			Lang: Lang(r.Lang), ReceivedAt: parseTime(r.ReceivedAt),
		})
	}
	return out, nil
}
