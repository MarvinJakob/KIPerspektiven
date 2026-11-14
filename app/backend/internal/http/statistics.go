package httpserver

import (
	"context"
	"errors"
	"time"

	"ki-web/backend/internal/api"
	"ki-web/backend/internal/service"
)

// Handler der Statistik (Ticket #130). Die öffentlichen Schreibzugriffe prüft guard auf die Herkunft,
// limitBody begrenzt ihren Anfragetext (maxPublicWriteBytes). /api/admin/statistics/* verlangt wie alle
// Redaktionspfade eine Sitzung mit Redaktionsrolle.

const msgBadPeriod = "Unbekannter Zeitraum. Erlaubt sind 7d, 30d und all."

func periodOf(p *api.Period) (service.Period, bool) {
	if p == nil {
		return service.DefaultPeriod, true
	}
	return service.ParsePeriod(string(*p))
}

func (s *apiServer) SaveReadinessResult(ctx context.Context, req api.SaveReadinessResultRequestObject) (api.SaveReadinessResultResponseObject, error) {
	if req.Body == nil {
		return api.SaveReadinessResult400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgNoBody}}, nil
	}
	ratings := make([]service.Rating, 0, len(req.Body.Ratings))
	for _, r := range req.Body.Ratings {
		ratings = append(ratings, service.Rating{Dimension: r.Dimension, Level: r.Level})
	}
	err := s.stats.SaveReadinessResult(ctx, req.Body.Key, service.Lang(req.Body.Lang), ratings)
	var verr *service.ValidationError
	switch {
	case errors.As(err, &verr):
		return api.SaveReadinessResult422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{Message: verr.Msg}}, nil
	case err != nil:
		return nil, err
	}
	return api.SaveReadinessResult204Response{}, nil
}

func (s *apiServer) DeleteReadinessResult(ctx context.Context, req api.DeleteReadinessResultRequestObject) (api.DeleteReadinessResultResponseObject, error) {
	err := s.stats.DeleteReadinessResult(ctx, req.Key)
	var verr *service.ValidationError
	switch {
	case errors.As(err, &verr):
		return api.DeleteReadinessResult422JSONResponse{UnprocessableJSONResponse: api.UnprocessableJSONResponse{Message: verr.Msg}}, nil
	case err != nil:
		return nil, err
	}
	return api.DeleteReadinessResult204Response{}, nil
}

func (s *apiServer) AdminGetPageViews(ctx context.Context, req api.AdminGetPageViewsRequestObject) (api.AdminGetPageViewsResponseObject, error) {
	period, ok := periodOf(req.Params.Period)
	if !ok {
		return api.AdminGetPageViews400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgBadPeriod}}, nil
	}
	st, err := s.stats.PageViews(ctx, period)
	if err != nil {
		return nil, err
	}
	days := make([]api.PageViewDay, 0, len(st.Days))
	for _, d := range st.Days {
		days = append(days, api.PageViewDay{Date: d.Day, Views: d.Views, UniqueViews: d.UniqueViews})
	}
	var since *string
	if !st.IdentitySince.IsZero() {
		value := st.IdentitySince.UTC().Format(time.RFC3339)
		since = &value
	}
	return api.AdminGetPageViews200JSONResponse{Period: api.StatisticsPeriod(period), Total: st.Total, UniqueTotal: st.UniqueTotal, UniqueSince: since, Days: days}, nil
}

func (s *apiServer) AdminListReadinessResults(ctx context.Context, req api.AdminListReadinessResultsRequestObject) (api.AdminListReadinessResultsResponseObject, error) {
	period, ok := periodOf(req.Params.Period)
	if !ok {
		return api.AdminListReadinessResults400JSONResponse{BadRequestJSONResponse: api.BadRequestJSONResponse{Message: msgBadPeriod}}, nil
	}
	page := 1
	if req.Params.Page != nil {
		page = *req.Params.Page
	}
	res, err := s.stats.ReadinessResults(ctx, period, page)
	if err != nil {
		return nil, err
	}

	// Titel und Reifegradnamen aus dem Audit-Katalog, damit die Redaktion Texte statt Slugs und Zahlen sieht.
	o := s.audit.Overview(service.DE)
	dims := make([]api.ReadinessDimensionName, 0, len(o.Dimensions))
	for _, d := range o.Dimensions {
		dims = append(dims, api.ReadinessDimensionName{Slug: d.Slug, Title: d.Title})
	}
	items := make([]api.ReadinessResult, 0, len(res.Items))
	for _, r := range res.Items {
		ratings := make([]api.ReadinessRating, 0, len(r.Ratings))
		for _, x := range r.Ratings {
			ratings = append(ratings, api.ReadinessRating{Dimension: x.Dimension, Level: x.Level})
		}
		items = append(items, api.ReadinessResult{Id: r.ID, Lang: api.Lang(r.Lang), SubmittedAt: r.SubmittedAt, Ratings: ratings})
	}
	return api.AdminListReadinessResults200JSONResponse{
		Period: api.StatisticsPeriod(period), Total: res.Total, Page: res.Page, PageSize: service.ResultsPageSize,
		Dimensions: dims, Levels: toAuditLevelInfos(o.Levels), Items: items,
	}, nil
}
