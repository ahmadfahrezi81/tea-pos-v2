package middleware

import (
	"net/http"
	"time"
)

// Standard is the chain every HTTP program uses, outermost first.
func Standard(h http.Handler, requestTimeout time.Duration, edgeSecret string) http.Handler {
	return RequestID(Logger(Recover(Edge(edgeSecret)(Gzip(Timeout(requestTimeout)(h))))))
}
