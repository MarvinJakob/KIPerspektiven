package httpserver

import (
	"context"
	"errors"

	"ki-web/backend/internal/api"
	"ki-web/backend/internal/service"
)

// Handler für /api/admin/users (Anforderung 11, Ticket #64). Nur Admin-Konten erreichen sie; das prüft guard vorab.

func toUserAPI(u service.User) api.User {
	return api.User{
		Id: u.ID, Email: u.Email, DisplayName: u.DisplayName, Roles: toRolesAPI(u.Roles), Active: u.Active, CreatedAt: u.CreatedAt,
	}
}

// fromRolesAPI wandelt Rollenangaben der API um. Die Prüfung übernimmt der Dienst.
func fromRolesAPI(rs api.Roles) service.Roles {
	out := make(service.Roles, len(rs))
	for i, r := range rs {
		out[i] = service.Role(r)
	}
	return out
}

func (s *apiServer) AdminListUsers(ctx context.Context, _ api.AdminListUsersRequestObject) (api.AdminListUsersResponseObject, error) {
	users, err := s.accounts.Users(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]api.User, 0, len(users))
	for _, u := range users {
		out = append(out, toUserAPI(u))
	}
	return api.AdminListUsers200JSONResponse{Items: out}, nil
}

// AdminCreateUser legt ein Konto mit mindestens einer Rolle an (REQ-64-AC1, REQ-64-AC2). Admins dürfen auch die
// Admin-Rolle vergeben (Entscheidung vom 18.11.2026); das erste Admin-Konto entsteht über `server user create`.
func (s *apiServer) AdminCreateUser(ctx context.Context, req api.AdminCreateUserRequestObject) (api.AdminCreateUserResponseObject, error) {
	if req.Body == nil {
		return api.AdminCreateUser400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgNoBody}}, nil
	}
	u, err := s.accounts.CreateUser(ctx, req.Body.Email, req.Body.Password, fromRolesAPI(req.Body.Roles))
	var verr *service.ValidationError
	switch {
	case errors.Is(err, service.ErrEmailTaken):
		return api.AdminCreateUser409JSONResponse{ConflictJSONResponse: api.ConflictJSONResponse{
			Message: "Für diese E-Mail-Adresse gibt es bereits ein Konto. Ein deaktiviertes Konto lässt sich in der Liste reaktivieren.",
		}}, nil
	case errors.As(err, &verr):
		return api.AdminCreateUser422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{Message: verr.Msg}}, nil
	case err != nil:
		return nil, err
	}
	return api.AdminCreateUser201JSONResponse(toUserAPI(u)), nil
}

// AdminUpdateUser ändert Rollen und/oder Status eines Kontos. Die Rollen werden zuerst gespeichert; scheitert
// das, bleibt auch der Status unverändert.
func (s *apiServer) AdminUpdateUser(ctx context.Context, req api.AdminUpdateUserRequestObject) (api.AdminUpdateUserResponseObject, error) {
	if req.Body == nil || (req.Body.Active == nil && req.Body.Roles == nil) {
		return api.AdminUpdateUser400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: "Bitte Rollen oder Status angeben."}}, nil
	}
	actor, _ := identityFrom(ctx)
	var (
		u   service.User
		err error
	)
	if req.Body.Roles != nil {
		u, err = s.accounts.SetRoles(ctx, actor.UserID, req.Id, fromRolesAPI(*req.Body.Roles))
	}
	if err == nil && req.Body.Active != nil {
		u, err = s.accounts.SetActive(ctx, actor.UserID, req.Id, *req.Body.Active)
	}
	var verr *service.ValidationError
	switch {
	case errors.Is(err, service.ErrNotFound):
		return api.AdminUpdateUser404JSONResponse{NotFoundJSONResponse: api.NotFoundJSONResponse{Message: "Konto nicht gefunden."}}, nil
	case errors.Is(err, service.ErrSelf):
		return api.AdminUpdateUser422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{
			Message: "Das eigene Konto lässt sich nicht deaktivieren.",
		}}, nil
	case errors.Is(err, service.ErrAdminFixed):
		return api.AdminUpdateUser422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{
			Message: "Einem Admin-Konto lässt sich die Admin-Rolle nicht entziehen.",
		}}, nil
	case errors.As(err, &verr):
		return api.AdminUpdateUser422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{Message: verr.Msg}}, nil
	case err != nil:
		return nil, err
	}
	return api.AdminUpdateUser200JSONResponse(toUserAPI(u)), nil
}
