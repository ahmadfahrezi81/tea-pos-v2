package middleware

import (
	"net/http"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/version"
)

var errAppTooOld = httpx.New(http.StatusUpgradeRequired, "app_too_old", "This version of the app is too old, update to continue")

// AppVersion notes the X-App-Version each app sends and answers 426 to a release older than
// min allows. Without the header, or from a build that is not a release (staging, a
// preview), a request always passes: the cut-off is for phones, never a lockout.
func AppVersion(min map[string]version.Release) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			raw := r.Header.Get("X-App-Version")
			if len(raw) > 64 {
				raw = raw[:64]
			}
			if info := InfoFrom(r.Context()); info != nil {
				info.AppVersion = raw
			}
			// The app name comes from the forwarder, which the phone cannot set.
			if want, ok := min[App(r.Context())]; ok {
				v, _ := version.ParseAppVersion(raw)
				if got, ok := version.ParseRelease(v.Version); ok && got.Less(want) {
					httpx.Write(w, errAppTooOld)
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
