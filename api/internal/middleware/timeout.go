package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"
)

// Timeout gives each request a deadline; queries that take the request's context stop with it.
// A WebSocket lives for minutes, so it has none (its own ping notices a dead one).
func Timeout(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if IsWebSocket(r) {
				next.ServeHTTP(w, r)
				return
			}
			ctx, cancel := context.WithTimeout(r.Context(), d)
			defer cancel()
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// IsWebSocket is an upgrade to a WebSocket.
func IsWebSocket(r *http.Request) bool {
	return strings.EqualFold(r.Header.Get("Upgrade"), "websocket")
}
