// Package handler is the HTTP layer: read the request, call a service, respond.
package handler

import (
	"encoding/json"
	"net/http"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/version"
)

// Health touches no dependency, so a database blip never makes Railway restart a healthy service.
func Health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"version": version.Version,
		"commit":  version.Commit,
	})
}
