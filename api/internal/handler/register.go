package handler

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/version"
)

// NewAPI mounts the contract on mux. The spec and docs pages stay off until admins can sign in.
func NewAPI(mux *http.ServeMux) huma.API {
	httpx.Install()
	cfg := huma.DefaultConfig("tea-pos API", version.Version)
	cfg.OpenAPIPath = ""
	cfg.DocsPath = ""
	cfg.SchemasPath = ""
	// No $schema field or Link header on every response.
	cfg.CreateHooks = nil
	api := humago.New(mux, cfg)
	registerHealth(api)
	// Unknown paths answer in the same error shape as everything else.
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		httpx.Write(w, httpx.NotFound("route_not_found", "No such route"))
	})
	return api
}
