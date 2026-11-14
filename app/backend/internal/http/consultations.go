package httpserver

import (
	"context"
	"errors"
	"time"

	"ki-web/backend/internal/api"
	"ki-web/backend/internal/service"
)

// Handler der Beratungsanfragen (Ticket #136, ADR 0011). Den öffentlichen Schreibzugriff prüft guard auf die
// Herkunft, limitBody begrenzt seinen Anfragetext (maxPublicWriteBytes). /api/admin/consultation-requests*
// verlangt wie alle Redaktionspfade eine Sitzung mit Redaktionsrolle.

// Begrenzung angenommener Beratungsanfragen je IP-Adresse. Sie bremst massenhaft eingetragene fremde
// Adressen, ohne Personen zu behindern, die sich vertippt haben und erneut senden.
const (
	consultationMaxRequests = 5
	consultationWindow      = time.Hour
)

func (s *apiServer) RequestConsultation(ctx context.Context, req api.RequestConsultationRequestObject) (api.RequestConsultationResponseObject, error) {
	if req.Body == nil {
		return api.RequestConsultation400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgNoBody}}, nil
	}
	ip := clientIPFrom(ctx)
	if !s.consultationLimiter.Allowed(ip) {
		return api.RequestConsultation429JSONResponse{Message: "Zu viele Anfragen. Bitte in einer Stunde erneut versuchen."}, nil
	}
	err := s.consultations.Request(ctx, req.Body.Email, service.Lang(req.Body.Lang))
	var verr *service.ValidationError
	switch {
	case errors.As(err, &verr):
		return api.RequestConsultation422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{Message: verr.Msg}}, nil
	case err != nil:
		return nil, err
	}
	s.consultationLimiter.Hit(ip)
	// Ohne Adresse: Das Protokoll enthält keine personenbezogenen Inhalte (ARCHITECTURE.md, Abschnitt 10).
	s.log.Info("beratungsanfrage eingegangen")
	return api.RequestConsultation204Response{}, nil
}

func (s *apiServer) AdminListConsultationRequests(ctx context.Context, _ api.AdminListConsultationRequestsRequestObject) (api.AdminListConsultationRequestsResponseObject, error) {
	reqs, err := s.consultations.List(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]api.ConsultationRequest, 0, len(reqs))
	for _, r := range reqs {
		items = append(items, api.ConsultationRequest{Id: r.ID, Email: r.Email, Lang: api.Lang(r.Lang), RequestedAt: r.RequestedAt})
	}
	return api.AdminListConsultationRequests200JSONResponse{Items: items}, nil
}

func (s *apiServer) AdminDeleteConsultationRequest(ctx context.Context, req api.AdminDeleteConsultationRequestRequestObject) (api.AdminDeleteConsultationRequestResponseObject, error) {
	err := s.consultations.Delete(ctx, req.Id)
	if errors.Is(err, service.ErrNotFound) {
		return api.AdminDeleteConsultationRequest404JSONResponse{NotFoundJSONResponse: api.NotFoundJSONResponse{Message: "Anfrage nicht gefunden."}}, nil
	}
	if err != nil {
		return nil, err
	}
	return api.AdminDeleteConsultationRequest204Response{}, nil
}
