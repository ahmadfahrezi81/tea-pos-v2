package handler

import (
	"context"
	"math"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

func registerMore(api huma.API, d Deps) {
	route(api, huma.Operation{
		OperationID: "listFeedbacks", Method: http.MethodGet, Path: "/tenants/{tenant}/feedbacks",
		Summary: "Where customers asked for a store, newest first", Tags: []string{"more"},
	}, storeAccess, func(ctx context.Context, in *contract.FeedbacksInput) (*contract.FeedbacksOutput, error) {
		caller, _ := auth.CallerFrom(ctx)
		rows, err := d.Queries.ListFeedbacks(ctx, store.ListFeedbacksParams{TenantID: caller.TenantID, RowLimit: int32(in.Limit)})
		if err != nil {
			return nil, err
		}
		out := &contract.FeedbacksOutput{}
		out.Body.Feedbacks = make([]contract.Feedback, len(rows))
		for i, r := range rows {
			out.Body.Feedbacks[i] = contract.Feedback{
				ID: r.ID.String(), LocationName: r.LocationName, LocationDisplay: r.LocationDisplay,
				Latitude: r.Latitude, Longitude: r.Longitude, Notes: r.Notes.String, At: tsz(r.CreatedAt), UserName: r.UserName.String,
			}
		}
		return out, nil
	})

	route(api, huma.Operation{
		OperationID: "getWeather", Method: http.MethodGet, Path: "/tenants/{tenant}/weather",
		Summary: "The forecast by hour, yesterday to tomorrow", Tags: []string{"more"},
	}, auth.SignedIn.InTenant(), func(ctx context.Context, _ *contract.TenantInput) (*contract.WeatherOutput, error) {
		today := time.Now().In(domain.WIB)
		day := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.UTC)
		rows, err := d.Queries.ListWeatherHourly(ctx, store.ListWeatherHourlyParams{FromDate: date(day.AddDate(0, 0, -1)), ToDate: date(day.AddDate(0, 0, 1))})
		if err != nil {
			return nil, err
		}
		out := &contract.WeatherOutput{}
		out.Body.Hours = make([]contract.WeatherHour, len(rows))
		for i, r := range rows {
			out.Body.City, out.Body.Region = r.City, r.Region
			out.Body.Hours[i] = contract.WeatherHour{
				Date: day0(r.Date), Hour: int(r.Hour), Temperature: math.Round(r.Temperature),
				RainChance: math.Round(r.PrecipitationProbability), Code: int(r.WeatherCode), FetchedAt: tsz(r.FetchedAt),
			}
		}
		return out, nil
	})
}
