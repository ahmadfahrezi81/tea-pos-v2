// Package httpx is the one place errors become HTTP responses.
package httpx

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

// Error is every error body the API sends. Code is stable and is what the apps translate.
type Error struct {
	Status  int      `json:"status" example:"409"`
	Code    string   `json:"code" example:"day_already_closed"`
	Message string   `json:"message" example:"The day is already closed"`
	Details []string `json:"details,omitempty"`
}

func (e *Error) Error() string  { return e.Message }
func (e *Error) GetStatus() int { return e.Status }

func New(status int, code, message string) *Error {
	return &Error{Status: status, Code: code, Message: message}
}

// Write sends e as JSON, for the few responses that do not go through Huma.
func Write(w http.ResponseWriter, e *Error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(e.Status)
	_ = json.NewEncoder(w).Encode(e)
}

func NotFound(code, message string) *Error { return New(http.StatusNotFound, code, message) }
func Conflict(code, message string) *Error { return New(http.StatusConflict, code, message) }

var codes = map[int]string{
	http.StatusBadRequest:          "bad_request",
	http.StatusUnauthorized:        "unauthorized",
	http.StatusForbidden:           "forbidden",
	http.StatusNotFound:            "not_found",
	http.StatusConflict:            "conflict",
	http.StatusUpgradeRequired:     "app_too_old",
	http.StatusTooManyRequests:     "too_many_requests",
	http.StatusInternalServerError: "internal",
}

// Install replaces Huma's own error shape with Error, so every response (and the spec) uses it.
func Install() {
	huma.NewError = func(status int, msg string, errs ...error) huma.StatusError {
		return build(context.Background(), status, msg, errs)
	}
	huma.NewErrorWithContext = func(ctx huma.Context, status int, msg string, errs ...error) huma.StatusError {
		return build(ctx.Context(), status, msg, errs)
	}
}

func build(ctx context.Context, status int, msg string, errs []error) *Error {
	// Huma reports invalid input as 422; the apps expect 400.
	if status == http.StatusUnprocessableEntity {
		status = http.StatusBadRequest
	}
	e := &Error{Status: status, Code: codes[status], Message: msg}
	if e.Code == "" {
		e.Code = "error"
	}
	if status >= 500 {
		slog.ErrorContext(ctx, "unexpected error", "status", status, "errs", errs)
		e.Message = "Something went wrong"
		return e
	}
	for _, err := range errs {
		if err != nil {
			e.Details = append(e.Details, err.Error())
		}
	}
	return e
}
