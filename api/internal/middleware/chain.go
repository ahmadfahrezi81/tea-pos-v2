package middleware

import (
	"net/http"
	"time"
)

// Standard is the chain every HTTP program uses, outermost first.
func Standard(h http.Handler, requestTimeout time.Duration) http.Handler {
	return RequestID(Logger(Recover(Gzip(Timeout(requestTimeout)(h)))))
}
