package httpserver

import (
	"context"
	"errors"
	"time"

	"ki-web/backend/internal/api"
	"ki-web/backend/internal/service"
)

// Handler der Kontaktseite (Anforderung #4). Den öffentlichen Schreibzugriff prüft guard auf die Herkunft,
// limitBody begrenzt seinen Anfragetext (maxContactBytes). /api/admin/contact-messages verlangt wie alle
// Redaktionspfade eine Sitzung mit Redaktionsrolle.

// Begrenzung angenommener Nachrichten je IP-Adresse. Sie bremst massenhaftes Einliefern, lässt aber reguläre
// Nutzung und mehrere Läufe der Fidelity-Suite pro Stunde (je Lauf bis zu zehn Nachrichten) zu.
const (
	contactMaxMessages = 100
	contactWindow      = time.Hour
)

func (s *apiServer) SendContactMessage(ctx context.Context, req api.SendContactMessageRequestObject) (api.SendContactMessageResponseObject, error) {
	if req.Body == nil {
		return api.SendContactMessage400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgNoBody}}, nil
	}
	attempt, ok := s.contactLimiter.Reserve(clientIPFrom(ctx))
	if !ok {
		return api.SendContactMessage429JSONResponse{Message: "Zu viele Nachrichten. Bitte später erneut versuchen."}, nil
	}
	defer attempt.Cancel()
	in := service.ContactInput{
		Name: req.Body.Name, Email: req.Body.Email, Message: req.Body.Message, Lang: service.Lang(req.Body.Lang),
	}
	if req.Body.Company != nil {
		in.Company = *req.Body.Company
	}
	err := s.contact.Send(ctx, in)
	var verr *service.ValidationError
	switch {
	case errors.As(err, &verr):
		return api.SendContactMessage422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{Message: verr.Msg}}, nil
	case err != nil:
		return nil, err
	}
	attempt.Count()
	// Ohne Inhalte: Das Protokoll enthält keine personenbezogenen Daten (ARCHITECTURE.md, Abschnitt 10).
	s.log.Info("kontaktnachricht eingegangen")
	return api.SendContactMessage204Response{}, nil
}

func (s *apiServer) AdminListContactMessages(ctx context.Context, _ api.AdminListContactMessagesRequestObject) (api.AdminListContactMessagesResponseObject, error) {
	msgs, err := s.contact.List(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]api.ContactMessage, 0, len(msgs))
	for _, m := range msgs {
		items = append(items, api.ContactMessage{
			Id: m.ID, Name: m.Name, Company: m.Company, Email: m.Email, Message: m.Message,
			Lang: api.Lang(m.Lang), ReceivedAt: m.ReceivedAt,
		})
	}
	return api.AdminListContactMessages200JSONResponse{Items: items}, nil
}

// AdminDeleteContactMessage löscht eine Nachricht sofort (Ticket #90). Sitzung, Rolle und CSRF-Token prüft guard.
func (s *apiServer) AdminDeleteContactMessage(ctx context.Context, req api.AdminDeleteContactMessageRequestObject) (api.AdminDeleteContactMessageResponseObject, error) {
	err := s.contact.Delete(ctx, req.Id)
	if errors.Is(err, service.ErrNotFound) {
		return api.AdminDeleteContactMessage404JSONResponse{NotFoundJSONResponse: api.NotFoundJSONResponse{Message: "Nachricht nicht gefunden."}}, nil
	}
	if err != nil {
		return nil, err
	}
	// Nur die ID: Das Protokoll enthält keine personenbezogenen Daten (ARCHITECTURE.md, Abschnitt 10).
	s.log.Info("kontaktnachricht gelöscht", "id", req.Id)
	return api.AdminDeleteContactMessage204Response{}, nil
}
