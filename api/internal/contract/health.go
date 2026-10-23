// Package contract holds every request and response shape; openapi.yaml is generated from it.
package contract

type HealthOutput struct {
	Body struct {
		Status  string `json:"status" example:"ok"`
		Version string `json:"version" example:"2026.10.3"`
		Commit  string `json:"commit" example:"a1b2c3d"`
	}
}
