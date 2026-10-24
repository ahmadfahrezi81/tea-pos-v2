package handler

import (
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/telemetry"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/version"
)

// Deps is what the handlers use. Printing the spec passes none: no handler runs then.
type Deps struct {
	Queries  *store.Queries
	Sessions *auth.Sessions
	Supabase auth.Supabase
	// Limiter for sign-in routes; NewAPI makes one when nil.
	Limiter *auth.Limiter
	// TestLoginKey turns on /auth/test, in a binary built with -tags testlogin (staging only).
	TestLoginKey string
	// Telemetry sends the apps' events and errors to PostHog; nil sends nothing.
	Telemetry *telemetry.Client
	// Flags defaults to Telemetry's; tests pass their own.
	Flags auth.Flags
}

// NewAPI mounts the contract on mux. The spec and docs pages stay off until admins can sign in.
func NewAPI(mux *http.ServeMux, d Deps) huma.API {
	api := newHuma(mux)
	if d.Limiter == nil {
		d.Limiter = auth.NewLimiter(10, time.Minute)
	}
	if d.Flags == nil {
		d.Flags = d.Telemetry
	}
	api.UseMiddleware(auth.Middleware(d.Sessions, d.Queries, d.Limiter, d.Flags))
	registerHealth(api)
	registerAuth(api, d)
	registerMe(api, d)
	registerEvents(api, d)
	registerTestLogin(api, d)
	return api
}

// NewHealth is /health alone, for the programs that serve nothing else over HTTP.
func NewHealth(mux *http.ServeMux) {
	registerHealth(newHuma(mux))
}

func newHuma(mux *http.ServeMux) huma.API {
	httpx.Install()
	cfg := huma.DefaultConfig("tea-pos API", version.Version)
	cfg.OpenAPIPath = ""
	cfg.DocsPath = ""
	cfg.SchemasPath = ""
	// No $schema field or Link header on every response.
	cfg.CreateHooks = nil
	api := humago.New(mux, cfg)
	// Unknown paths answer in the same error shape as everything else.
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		httpx.Write(w, httpx.NotFound("route_not_found", "No such route"))
	})
	return api
}
