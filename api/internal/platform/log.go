// Package platform holds what every program shares: logging and the HTTP server.
package platform

import (
	"context"
	"log/slog"
	"os"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/middleware"
)

// SetupLog makes slog write JSON to stdout, which Railway's log view reads.
func SetupLog(service, env string, level slog.Level) {
	h := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	slog.SetDefault(slog.New(contextHandler{h}).With("service", service, "env", env))
}

// contextHandler adds request_id to every line written with a request's context.
type contextHandler struct{ slog.Handler }

func (h contextHandler) Handle(ctx context.Context, r slog.Record) error {
	if id := middleware.RequestIDFrom(ctx); id != "" {
		r.AddAttrs(slog.String("request_id", id))
	}
	return h.Handler.Handle(ctx, r)
}

func (h contextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return contextHandler{h.Handler.WithAttrs(attrs)}
}

func (h contextHandler) WithGroup(name string) slog.Handler {
	return contextHandler{h.Handler.WithGroup(name)}
}
