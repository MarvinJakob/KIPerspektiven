package httpserver

import (
	"context"
	"errors"
	"io"

	"ki-web/backend/internal/api"
	"ki-web/backend/internal/media"
	"ki-web/backend/internal/service"
)

func (s *apiServer) ListArticles(ctx context.Context, req api.ListArticlesRequestObject) (api.ListArticlesResponseObject, error) {
	if !validLang(req.Params.Lang) {
		return api.ListArticles400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgBadLang}}, nil
	}
	article, err := s.svc.Articles(ctx, langOf(req.Params.Lang))

	return api.ListArticles200JSONResponse(article), err
}

func (s *apiServer) GetArticle(ctx context.Context, req api.GetArticleRequestObject) (api.GetArticleResponseObject, error) {
	if !validLang(req.Params.Lang) {
		return api.GetArticle400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgBadLang}}, nil
	}
	article, err := s.svc.Article(ctx, req.Id, langOf(req.Params.Lang))
	if errors.Is(err, service.ErrNotFound) {
		return api.GetArticle404JSONResponse{NotFoundJSONResponse: api.NotFoundJSONResponse{Message: "Themenartikel nicht gefunden."}}, nil
	}
	return api.GetArticle200JSONResponse(article), err
}

func (s *apiServer) AdminListArticles(ctx context.Context, req api.AdminListArticlesRequestObject) (api.AdminListArticlesResponseObject, error) {

	article, err := s.editorial.Articles(ctx)

	return api.AdminListArticles200JSONResponse(article), err
}

func (s *apiServer) AdminGetArticle(ctx context.Context, req api.AdminGetArticleRequestObject) (api.AdminGetArticleResponseObject, error) {

	article, err := s.editorial.Article(ctx, req.Id)
	if errors.Is(err, service.ErrNotFound) {
		return api.AdminGetArticle404JSONResponse{NotFoundJSONResponse: api.NotFoundJSONResponse{Message: "Themenartikel nicht gefunden."}}, nil
	}
	return api.AdminGetArticle200JSONResponse(article), err
}

func (s *apiServer) AdminUpdateArticle(ctx context.Context, req api.AdminUpdateArticleRequestObject) (api.AdminUpdateArticleResponseObject, error) {
	if req.Body == nil {
		return api.AdminUpdateArticle400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgNoBody}}, nil
	}
	id, _ := identityFrom(ctx)
	article, err := s.editorial.SaveArticle(ctx, &req.Id, id.UserID, *req.Body)
	if errors.Is(err, service.ErrNotFound) {
		return api.AdminUpdateArticle404JSONResponse{NotFoundJSONResponse: api.NotFoundJSONResponse{Message: "Themenartikel nicht gefunden."}}, nil
	}
	var validation *service.ValidationError
	if errors.As(err, &validation) {
		return api.AdminUpdateArticle422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{Message: validation.Msg}}, nil
	}
	return api.AdminUpdateArticle200JSONResponse(article), err
}

func (s *apiServer) AdminCreateArticle(ctx context.Context, req api.AdminCreateArticleRequestObject) (api.AdminCreateArticleResponseObject, error) {
	if req.Body == nil {
		return api.AdminCreateArticle400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgNoBody}}, nil
	}
	id, _ := identityFrom(ctx)
	article, err := s.editorial.SaveArticle(ctx, nil, id.UserID, *req.Body)

	var validation *service.ValidationError
	if errors.As(err, &validation) {
		return api.AdminCreateArticle422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{Message: validation.Msg}}, nil
	}
	return api.AdminCreateArticle201JSONResponse(article), err
}

func (s *apiServer) AdminDeleteArticle(ctx context.Context, req api.AdminDeleteArticleRequestObject) (api.AdminDeleteArticleResponseObject, error) {
	err := s.editorial.DeleteArticle(ctx, req.Id)
	if errors.Is(err, service.ErrNotFound) {
		return api.AdminDeleteArticle404JSONResponse{NotFoundJSONResponse: api.NotFoundJSONResponse{Message: "Themenartikel nicht gefunden."}}, nil
	}
	return api.AdminDeleteArticle204Response{}, err
}

func (s *apiServer) AdminUploadArticleImage(ctx context.Context, req api.AdminUploadArticleImageRequestObject) (api.AdminUploadArticleImageResponseObject, error) {
	if s.media == nil {
		return nil, errors.New(msgNoMedia)
	}
	if req.Body == nil {
		return api.AdminUploadArticleImage400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgNoBody}}, nil
	}
	for {
		part, err := req.Body.NextPart()
		if errors.Is(err, io.EOF) {
			return api.AdminUploadArticleImage422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{Message: "Bitte eine Bilddatei auswählen."}}, nil
		}
		if err != nil {
			return api.AdminUploadArticleImage400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgNoBody}}, nil
		}
		if part.FormName() != "file" {
			continue
		}
		stored, err := s.media.Save(part)
		var upload *media.UploadError
		if errors.As(err, &upload) {
			return api.AdminUploadArticleImage422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{Message: upload.Msg}}, nil
		}
		if err != nil {
			return nil, err
		}
		return api.AdminUploadArticleImage200JSONResponse{Src: media.URL(stored.Key, stored.MimeType, "960")}, nil
	}
}
