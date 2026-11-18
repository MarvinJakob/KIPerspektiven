package httpserver

import (
	"context"
	"errors"
	"io"

	"ki-web/backend/internal/api"
	"ki-web/backend/internal/auth"
	"ki-web/backend/internal/media"
	"ki-web/backend/internal/service"
)

// Handler für /api/profile (Ticket #64). Jede gültige Sitzung erreicht sie; sie wirken nur auf das eigene
// Konto der Sitzung. Rollen lassen sich hier nicht ändern.

const msgUnauthenticated = "Anmeldung erforderlich."

func toProfileAPI(p service.Profile) api.Profile {
	return api.Profile{Email: p.Email, DisplayName: p.DisplayName, Roles: toRolesAPI(p.Roles), Avatar: toAvatar(p.Avatar)}
}

func (s *apiServer) GetProfile(ctx context.Context, _ api.GetProfileRequestObject) (api.GetProfileResponseObject, error) {
	id, ok := identityFrom(ctx)
	if !ok {
		return api.GetProfile401JSONResponse{UnauthorizedJSONResponse: api.UnauthorizedJSONResponse{Message: msgUnauthenticated}}, nil
	}
	p, err := s.accounts.Profile(ctx, id.UserID)
	if err != nil {
		return nil, err
	}
	return api.GetProfile200JSONResponse(toProfileAPI(p)), nil
}

func (s *apiServer) UpdateProfile(ctx context.Context, req api.UpdateProfileRequestObject) (api.UpdateProfileResponseObject, error) {
	id, ok := identityFrom(ctx)
	if !ok {
		return api.UpdateProfile401JSONResponse{UnauthorizedJSONResponse: api.UnauthorizedJSONResponse{Message: msgUnauthenticated}}, nil
	}
	if req.Body == nil {
		return api.UpdateProfile400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgNoBody}}, nil
	}
	p, err := s.accounts.SetDisplayName(ctx, id.UserID, req.Body.DisplayName)
	var verr *service.ValidationError
	if errors.As(err, &verr) {
		return api.UpdateProfile422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{Message: verr.Msg}}, nil
	}
	if err != nil {
		return nil, err
	}
	return api.UpdateProfile200JSONResponse(toProfileAPI(p)), nil
}

// ChangePassword ändert das eigene Passwort. Die Prüfung des aktuellen Passworts läuft wie die Anmeldung über die
// Begrenzungen aus Ticket #138: Fehlversuche zählen je IP-Adresse, Argon2-Prüfungen sind global begrenzt.
func (s *apiServer) ChangePassword(ctx context.Context, req api.ChangePasswordRequestObject) (api.ChangePasswordResponseObject, error) {
	id, ok := identityFrom(ctx)
	if !ok {
		return api.ChangePassword401JSONResponse{UnauthorizedJSONResponse: api.UnauthorizedJSONResponse{Message: msgUnauthenticated}}, nil
	}
	if req.Body == nil {
		return api.ChangePassword400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgNoBody}}, nil
	}
	attempt, ok := s.limiter.Reserve(clientIPFrom(ctx))
	if !ok {
		return api.ChangePassword429JSONResponse{Message: "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen."}, nil
	}
	defer attempt.Cancel()
	if err := s.passwordChecks.Acquire(ctx); err != nil {
		if errors.Is(err, auth.ErrBusy) || ctx.Err() != nil {
			return api.ChangePassword503JSONResponse{
				Body:    api.Error{Message: "Die Passwortprüfung ist gerade ausgelastet. Bitte in einigen Sekunden erneut versuchen."},
				Headers: api.ChangePassword503ResponseHeaders{RetryAfter: loginRetryAfter},
			}, nil
		}
		return nil, err
	}
	err := s.accounts.ChangePassword(ctx, id, req.Body.CurrentPassword, req.Body.NewPassword)
	s.passwordChecks.Release()
	var verr *service.ValidationError
	switch {
	case errors.Is(err, service.ErrWrongPassword):
		attempt.Count()
		return api.ChangePassword422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{
			Message: "Das aktuelle Passwort ist falsch. Das Passwort wurde nicht geändert.",
		}}, nil
	case errors.As(err, &verr):
		return api.ChangePassword422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{
			Message: verr.Msg + " Das Passwort wurde nicht geändert.",
		}}, nil
	case errors.Is(err, service.ErrUnauthenticated):
		return api.ChangePassword401JSONResponse{UnauthorizedJSONResponse: api.UnauthorizedJSONResponse{Message: msgUnauthenticated}}, nil
	case err != nil:
		return nil, err
	}
	attempt.Reset()
	return api.ChangePassword204Response{}, nil
}

// SetProfileAvatar nimmt ein Bild aus dem Feld „file“ entgegen. Ein abgelehnter Upload ändert nichts; nach einem
// Fehler beim Speichern werden die neuen Dateien gelöscht, nach Erfolg die des ersetzten Bilds.
func (s *apiServer) SetProfileAvatar(ctx context.Context, req api.SetProfileAvatarRequestObject) (api.SetProfileAvatarResponseObject, error) {
	id, ok := identityFrom(ctx)
	if !ok {
		return api.SetProfileAvatar401JSONResponse{UnauthorizedJSONResponse: api.UnauthorizedJSONResponse{Message: msgUnauthenticated}}, nil
	}
	if s.media == nil {
		return nil, errors.New(msgNoMedia)
	}
	if req.Body == nil {
		return api.SetProfileAvatar400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgNoBody}}, nil
	}
	var stored media.Stored
	found := false
	for {
		part, err := req.Body.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return api.SetProfileAvatar400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgNoBody}}, nil
		}
		if part.FormName() != "file" {
			continue
		}
		found = true
		stored, err = s.media.Save(part)
		var uerr *media.UploadError
		if errors.As(err, &uerr) {
			return api.SetProfileAvatar422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{Message: uerr.Msg}}, nil
		}
		if err != nil {
			return nil, err
		}
		break
	}
	if !found {
		return api.SetProfileAvatar422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{Message: "Bitte eine Bilddatei auswählen."}}, nil
	}
	p, old, err := s.accounts.SetAvatar(ctx, id.UserID, stored)
	if err != nil {
		s.removeMedia(stored.Key, stored.MimeType)
		return nil, err
	}
	if old != nil {
		s.removeMedia(old.Key, old.MimeType)
	}
	return api.SetProfileAvatar200JSONResponse(toProfileAPI(p)), nil
}
