// Package handler is the HTTP layer: read the request, call a service, respond.
package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/version"
)

// Health touches no dependency, so a database blip never makes Railway restart a healthy service.
func registerHealth(api huma.API) {
	huma.Register(api, huma.Operation{
		OperationID: "getHealth",
		Method:      http.MethodGet,
		Path:        "/health",
		Summary:     "Service health, version and commit",
		Tags:        []string{"system"},
	}, func(context.Context, *struct{}) (*contract.HealthOutput, error) {
		out := &contract.HealthOutput{}
		out.Body.Status = "ok"
		out.Body.Version = version.Version
		out.Body.Commit = version.Commit
		return out, nil
	})
}
