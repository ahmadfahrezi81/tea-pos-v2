package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/middleware"
)

func registerEvents(api huma.API, d Deps) {
	route(api, huma.Operation{
		OperationID:   "sendEvents",
		Method:        http.MethodPost,
		Path:          "/events",
		Summary:       "Errors and page views from an app, for PostHog",
		Tags:          []string{"system"},
		DefaultStatus: http.StatusNoContent,
	}, auth.SignedIn, func(ctx context.Context, in *contract.EventsInput) (*struct{}, error) {
		caller, _ := auth.CallerFrom(ctx)
		user := caller.UserID.String()
		origin := middleware.AppOrigin(ctx)
		appVersion := ""
		if info := middleware.InfoFrom(ctx); info != nil {
			appVersion = info.AppVersion
		}
		now := time.Now()
		for _, e := range in.Body.Events {
			at := e.At
			if at.After(now.Add(time.Hour)) || at.Before(now.Add(-24*time.Hour)) {
				at = now
			}
			props := map[string]any{
				"$current_url": origin + e.Path,
				"$pathname":    e.Path,
				"app":          caller.App,
				"app_version":  appVersion,
				"role":         caller.Role,
			}
			if e.Type == "error" {
				d.Telemetry.Exception(user, e.Name, e.Message, e.Stack, props, at)
			} else {
				d.Telemetry.Capture(user, "$pageview", props, at)
			}
		}
		return nil, nil
	})
}
