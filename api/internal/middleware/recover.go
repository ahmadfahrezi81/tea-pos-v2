package middleware

import (
	"log/slog"
	"net/http"
	"runtime/debug"
)

// Recover turns a panic into a logged 500. ErrAbortHandler is a deliberate abort, so it passes through.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			p := recover()
			if p == nil {
				return
			}
			if p == http.ErrAbortHandler {
				panic(p)
			}
			slog.ErrorContext(r.Context(), "panic", "panic", p, "stack", string(debug.Stack()))
			http.Error(w, `{"error":"internal"}`, http.StatusInternalServerError)
		}()
		next.ServeHTTP(w, r)
	})
}
