package middleware

import (
	"net/http"
	"time"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/version"
)

type Options struct {
	RequestTimeout time.Duration
	EdgeSecret     string
	// MinAppVersions: older app releases get 426 (config MIN_APP_VERSION).
	MinAppVersions map[string]version.Release
}

// Standard is the chain every HTTP program uses, outermost first.
func Standard(h http.Handler, o Options) http.Handler {
	return RequestID(Track(Logger(Recover(Edge(o.EdgeSecret)(AppVersion(o.MinAppVersions)(Gzip(Timeout(o.RequestTimeout)(h))))))))
}
