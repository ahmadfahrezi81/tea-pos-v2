package telemetry

import (
	"regexp"
	"strconv"
	"strings"
)

// What PostHog's own browser library would have added, worked out here from the request:
// the phones never load it.

var (
	androidRe = regexp.MustCompile(`Android (\d+(?:\.\d+)*)`)
	iosRe     = regexp.MustCompile(`(?:iPhone|iPad|iPod).*? OS (\d+)_(\d+)`)
	browserRe = []struct {
		name string
		re   *regexp.Regexp
	}{
		{"Samsung Internet", regexp.MustCompile(`SamsungBrowser/(\d+)`)},
		{"Microsoft Edge", regexp.MustCompile(`Edg(?:A|iOS)?/(\d+)`)},
		{"Opera", regexp.MustCompile(`OPR/(\d+)`)},
		{"Firefox", regexp.MustCompile(`(?:Firefox|FxiOS)/(\d+)`)},
		{"Chrome", regexp.MustCompile(`(?:Chrome|CriOS)/(\d+)`)},
		{"Safari", regexp.MustCompile(`Version/(\d+).*Safari`)},
	}
)

// UserAgent is $os, $os_version, $browser, $browser_version and $device_type for PostHog.
func UserAgent(ua string) map[string]any {
	p := map[string]any{"$raw_user_agent": ua}
	switch {
	case androidRe.MatchString(ua):
		p["$os"], p["$os_version"] = "Android", androidRe.FindStringSubmatch(ua)[1]
	case iosRe.MatchString(ua):
		m := iosRe.FindStringSubmatch(ua)
		p["$os"], p["$os_version"] = "iOS", m[1]+"."+m[2]
	case strings.Contains(ua, "Windows"):
		p["$os"] = "Windows"
	case strings.Contains(ua, "Mac OS X"):
		p["$os"] = "Mac OS X"
	case strings.Contains(ua, "Linux"):
		p["$os"] = "Linux"
	}
	for _, b := range browserRe {
		if m := b.re.FindStringSubmatch(ua); m != nil {
			v, _ := strconv.Atoi(m[1])
			p["$browser"], p["$browser_version"] = b.name, v
			break
		}
	}
	switch {
	case strings.Contains(ua, "iPad") || (strings.Contains(ua, "Android") && !strings.Contains(ua, "Mobile")):
		p["$device_type"] = "Tablet"
	case strings.Contains(ua, "Mobi") || strings.Contains(ua, "iPhone"):
		p["$device_type"] = "Mobile"
	default:
		p["$device_type"] = "Desktop"
	}
	return p
}

// Frame is one line of a stack in PostHog's shape.
type Frame struct {
	Platform string `json:"platform"`
	Filename string `json:"filename"`
	Function string `json:"function"`
	LineNo   int    `json:"lineno,omitempty"`
	ColNo    int    `json:"colno,omitempty"`
	InApp    bool   `json:"in_app"`
	ChunkID  string `json:"chunk_id,omitempty"`
}

var (
	// Chrome: "    at fn (https://x/a.js:1:2)" or "    at https://x/a.js:1:2".
	chromeFrameRe = regexp.MustCompile(`^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$`)
	// Safari and Firefox: "fn@https://x/a.js:1:2".
	geckoFrameRe = regexp.MustCompile(`^\s*(.*?)@(.+?):(\d+):(\d+)\s*$`)
)

// maxFrames is PostHog's own limit for browser stacks.
const maxFrames = 50

// ParseStack turns a browser's stack text into frames, outermost call first as PostHog wants,
// each with its file's chunk id so PostHog finds the uploaded source map.
func ParseStack(stack string, chunks map[string]string) []Frame {
	var frames []Frame
	for line := range strings.SplitSeq(stack, "\n") {
		if len(line) > 1024 || len(frames) == maxFrames {
			continue
		}
		m := chromeFrameRe.FindStringSubmatch(line)
		if m == nil {
			m = geckoFrameRe.FindStringSubmatch(line)
		}
		if m == nil {
			continue
		}
		fn := m[1]
		if fn == "" || fn == "<anonymous>" {
			fn = "?"
		}
		lineNo, _ := strconv.Atoi(m[3])
		col, _ := strconv.Atoi(m[4])
		frames = append(frames, Frame{
			Platform: "web:javascript",
			Filename: m[2],
			Function: fn,
			LineNo:   lineNo,
			ColNo:    col,
			InApp:    strings.HasPrefix(m[2], "http"),
			ChunkID:  chunks[m[2]],
		})
	}
	for i, j := 0, len(frames)-1; i < j; i, j = i+1, j-1 {
		frames[i], frames[j] = frames[j], frames[i]
	}
	return frames
}
