package middleware

import (
	"net/http"

	"github.com/klauspost/compress/gzhttp"
)

// Gzip compresses responses the client accepts; tiny and already-compressed ones are left alone,
// and a WebSocket upgrade passes straight through.
func Gzip(next http.Handler) http.Handler {
	gz := gzhttp.GzipHandler(next)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if IsWebSocket(r) {
			next.ServeHTTP(w, r)
			return
		}
		gz.ServeHTTP(w, r)
	})
}
