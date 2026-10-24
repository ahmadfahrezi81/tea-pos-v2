package version

import (
	"strconv"
	"strings"
)

// Release is a release version, YYYY.MM.N: the Nth release that month.
type Release [3]int

// ParseRelease reads "2026.10.3". Anything else (staging, preview, dev) is not a release.
func ParseRelease(s string) (Release, bool) {
	parts := strings.Split(s, ".")
	if len(parts) != 3 {
		return Release{}, false
	}
	var r Release
	for i, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil || strings.TrimLeft(p, "0123456789") != "" {
			return Release{}, false
		}
		r[i] = n
	}
	if r[0] < 2000 || r[1] < 1 || r[1] > 12 || r[2] < 1 {
		return Release{}, false
	}
	return r, true
}

func (r Release) Less(o Release) bool {
	for i := range r {
		if r[i] != o[i] {
			return r[i] < o[i]
		}
	}
	return false
}

// AppVersion is what an app sends in X-App-Version: "seller@2026.10.3+a1b2c3d".
type AppVersion struct {
	App, Version, Commit string
}

func ParseAppVersion(s string) (AppVersion, bool) {
	app, rest, ok := strings.Cut(s, "@")
	if !ok || app == "" || rest == "" {
		return AppVersion{}, false
	}
	v, commit, _ := strings.Cut(rest, "+")
	return AppVersion{App: app, Version: v, Commit: commit}, v != ""
}
