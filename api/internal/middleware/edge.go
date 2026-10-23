package middleware

import (
	"context"
	"crypto/subtle"
	"net"
	"net/http"
	"net/url"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
)

type (
	clientIPKey  struct{}
	appKey       struct{}
	appOriginKey struct{}
)

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
			// Trusted only now: the forwarder sets these from Cloudflare and the app's own address.
			ip := r.Header.Get("X-Client-IP")
			if net.ParseIP(ip) == nil {
				ip, _, _ = net.SplitHostPort(r.RemoteAddr)
			}
			ctx := context.WithValue(r.Context(), clientIPKey{}, ip)
			if app := r.Header.Get("X-App"); app == "seller" || app == "backoffice" {
				ctx = context.WithValue(ctx, appKey{}, app)
			}
			if origin, err := url.Parse(r.Header.Get("X-App-Origin")); err == nil &&
				(origin.Scheme == "https" || origin.Scheme == "http") && origin.Host != "" {
				ctx = context.WithValue(ctx, appOriginKey{}, origin.Scheme+"://"+origin.Host)
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func ClientIP(ctx context.Context) string {
	ip, _ := ctx.Value(clientIPKey{}).(string)
	return ip
}

// App is the app calling, "seller" or "backoffice"; empty when the forwarder did not say.
func App(ctx context.Context) string {
	app, _ := ctx.Value(appKey{}).(string)
	return app
}

// AppOrigin is the address the user sees (a PR preview's own, for example), for redirects back to the app.
func AppOrigin(ctx context.Context) string {
	origin, _ := ctx.Value(appOriginKey{}).(string)
	return origin
}
