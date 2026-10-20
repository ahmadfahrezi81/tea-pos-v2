package middleware

import (
	"net/http"

	"github.com/klauspost/compress/gzhttp"
)

// Gzip compresses responses the client accepts; tiny and already-compressed ones are left alone.
func Gzip(next http.Handler) http.Handler {
	return gzhttp.GzipHandler(next)
}
