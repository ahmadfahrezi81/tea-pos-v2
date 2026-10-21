package middleware

import (
	"context"
	"crypto/subtle"
	"net"
	"net/http"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
)

type clientIPKey struct{}

// Edge lets through only requests from our Cloudflare forwarder, so Railway's own address leads nowhere.
// /health stays open for Railway's health check.
func Edge(secret string) func(http.Handler) http.Handler {
	want := []byte(secret)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/health" {
				next.ServeHTTP(w, r)
				return
			}
			if subtle.ConstantTimeCompare([]byte(r.Header.Get("X-Edge-Secret")), want) != 1 {
				httpx.Write(w, httpx.NotFound("route_not_found", "No such route"))
				return
			}
			// Trusted only now: the forwarder sets it from Cloudflare's CF-Connecting-IP.
			ip := r.Header.Get("X-Client-IP")
			if net.ParseIP(ip) == nil {
				ip, _, _ = net.SplitHostPort(r.RemoteAddr)
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), clientIPKey{}, ip)))
		})
	}
}

func ClientIP(ctx context.Context) string {
	ip, _ := ctx.Value(clientIPKey{}).(string)
	return ip
}
