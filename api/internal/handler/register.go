package handler

import (
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/files"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/idem"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/telemetry"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/version"
)

// Deps is what the handlers use. Printing the spec passes none: no handler runs then.
type Deps struct {
	// Docs serves /docs and /openapi.yaml: on a laptop only.
	Docs bool
	// DB runs Idempotent writes in their own transaction (internal/idem).
	DB       *pgxpool.Pool
	Queries  *store.Queries
	Sessions *auth.Sessions
	Supabase auth.Supabase
	// Limiter for sign-in routes; NewAPI makes one when nil.
	Limiter *auth.Limiter
	// SessionLimiter caps each signed-in session; NewAPI makes one when nil.
	SessionLimiter *auth.Limiter
	// TestLoginKey turns on /auth/test, in a binary built with -tags testlogin (staging only).
	TestLoginKey string
	// Telemetry sends the apps' events and errors to PostHog; nil sends nothing.
	Telemetry *telemetry.Client
	// Flags defaults to Telemetry's; tests pass their own.
	Flags auth.Flags
	// Files signs uploads and private reads in Supabase Storage.
	Files *files.Storage
}

// NewAPI mounts the contract on mux, and on a laptop the reference (/docs).
func NewAPI(mux *http.ServeMux, d Deps) huma.API {
	api := newHuma(mux)
	if d.Limiter == nil {
		d.Limiter = auth.NewLimiter(10, time.Minute)
	}
	if d.SessionLimiter == nil {
		// 10 a second for a whole minute: live updates in a rush stay far below; a loop does not.
		d.SessionLimiter = auth.NewLimiter(600, time.Minute)
	}
	if d.Flags == nil {
		d.Flags = d.Telemetry
	}
	api.UseMiddleware(auth.Middleware(d.Sessions, d.Queries, d.Limiter, d.SessionLimiter, d.Flags))
	api.UseMiddleware(idem.Middleware(d.DB))
	registerHealth(api)
	registerAuth(api, d)
	registerMe(api, d)
	registerMePatch(api, d)
	registerEvents(api, d)
	registerFiles(api, d)
	registerSales(api, d)
	registerDays(api, d)
	registerOrders(api, d)
	registerPay(api, d)
	registerPayouts(api, d)
	registerSettle(api, d)
	registerMore(api, d)
	registerStores(api, d)
	registerSeller(api, d)
	registerMine(api, d)
	registerUac(api, d)
	registerTestLogin(api, d)
	if d.Docs {
		registerDocs(mux, api)
	}
	return api
}

// registerDocs is the API's reference for a laptop, through the local /api: /api/docs.
func registerDocs(mux *http.ServeMux, api huma.API) {
	mux.HandleFunc("GET /openapi.yaml", func(w http.ResponseWriter, _ *http.Request) {
		b, err := api.OpenAPI().YAML()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/yaml")
		_, _ = w.Write(b)
	})
	mux.HandleFunc("GET /docs", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		// The scripts go in <body>: in <head> the reference finds no body to draw into.
		_, _ = w.Write([]byte(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>tea-pos API</title>
<body>
<script id="api-reference" data-url="/api/openapi.yaml"></script>
<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.25.0"></script>`))
	})
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
	// The apps reach Go at their own /api, so the reference's Test Request does too.
	cfg.Servers = []*huma.Server{{URL: "/api"}}
	// No $schema field or Link header on every response.
	cfg.CreateHooks = nil
	api := humago.New(mux, cfg)
	// Unknown paths answer in the same error shape as everything else.
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		httpx.Write(w, errRouteNotFound)
	})
	return api
}
