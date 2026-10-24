// Package platform holds what every program shares: logging and the HTTP server.
package platform

import (
	"context"
	"log/slog"
	"os"

	"github.com/posthog/posthog-go"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/middleware"
)

// SetupLog makes slog write JSON to stdout, which Railway's log view reads. With report set,
// every error logged is also sent to PostHog's error tracking, with its request's user.
func SetupLog(service, env string, level slog.Level, report posthog.EnqueueClient) {
	var h slog.Handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	if report != nil {
		h = posthog.NewSlogCaptureHandler(h, report,
			posthog.WithMinCaptureLevel(slog.LevelError),
			posthog.WithDistinctIDFn(func(ctx context.Context, r slog.Record) string {
				// A 5xx's request line repeats the error already logged where it happened.
				if r.Message == middleware.RequestLogMessage {
					return ""
				}
				if info := middleware.InfoFrom(ctx); info != nil && info.UserID != "" {
					return info.UserID
				}
				return service
			}),
			posthog.WithPropertiesFn(func(ctx context.Context, r slog.Record) posthog.Properties {
				p := posthog.SlogAttrsAsProperties(ctx, r).Set("service", service)
				if info := middleware.InfoFrom(ctx); info != nil && info.AppVersion != "" {
					p.Set("app_version", info.AppVersion)
				}
				return p
			}),
		)
	}
	slog.SetDefault(slog.New(contextHandler{h}).With("service", service, "env", env))
}

// contextHandler adds the request id, user and tenant to every line written with a request's context.
type contextHandler struct{ slog.Handler }

func (h contextHandler) Handle(ctx context.Context, r slog.Record) error {
	if id := middleware.RequestIDFrom(ctx); id != "" {
		r.AddAttrs(slog.String("request_id", id))
	}
	if info := middleware.InfoFrom(ctx); info != nil && info.UserID != "" {
		r.AddAttrs(slog.String("user_id", info.UserID))
		if info.TenantID != "" {
			r.AddAttrs(slog.String("tenant_id", info.TenantID))
		}
	}
	return h.Handler.Handle(ctx, r)
}

func (h contextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return contextHandler{h.Handler.WithAttrs(attrs)}
}

func (h contextHandler) WithGroup(name string) slog.Handler {
	return contextHandler{h.Handler.WithGroup(name)}
}
