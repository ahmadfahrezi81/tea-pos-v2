//go:build integration

package integration

import (
	"testing"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/telemetry"
)

func TestParseStack(t *testing.T) {
	const chrome = `TypeError: Cannot read properties of undefined (reading 'name')
    at Ho (https://tea-pos.lykostech.app/assets/_shell-CwxhaolQ.js:1:2345)
    at async https://tea-pos.lykostech.app/assets/index-DWOnKnHW.js:12:99
    at https://tea-pos.lykostech.app/assets/index-DWOnKnHW.js:3:4`
	const safari = `Ho@https://tea-pos.lykostech.app/assets/_shell-CwxhaolQ.js:1:2345
@https://tea-pos.lykostech.app/assets/index-DWOnKnHW.js:3:4`
	chunks := map[string]string{"https://tea-pos.lykostech.app/assets/_shell-CwxhaolQ.js": "chunk-shell"}

	for name, stack := range map[string]string{"chrome": chrome, "safari": safari} {
		frames := telemetry.ParseStack(stack, chunks)
		if len(frames) < 2 {
			t.Fatalf("%s: %d frames", name, len(frames))
		}
		// Outermost first: the throwing frame is last.
		last := frames[len(frames)-1]
		if last.Function != "Ho" || last.Filename != "https://tea-pos.lykostech.app/assets/_shell-CwxhaolQ.js" ||
			last.LineNo != 1 || last.ColNo != 2345 || last.ChunkID != "chunk-shell" || !last.InApp || last.Platform != "web:javascript" {
			t.Errorf("%s: last frame %+v", name, last)
		}
		if first := frames[0]; first.Function != "?" || first.LineNo != 3 || first.ChunkID != "" {
			t.Errorf("%s: first frame %+v", name, first)
		}
	}
	if f := telemetry.ParseStack("no frames here", nil); len(f) != 0 {
		t.Errorf("frames from nothing: %+v", f)
	}
}

func TestUserAgent(t *testing.T) {
	for _, c := range []struct {
		ua, os, osVersion, browser, device string
	}{
		// Chrome on a Galaxy M11: reduced user agent, Android frozen at 10.
		{"Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36", "Android", "10", "Chrome", "Mobile"},
		{"Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-M115F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36", "Android", "13", "Samsung Internet", "Mobile"},
		{"Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1", "iOS", "18.6", "Safari", "Mobile"},
		{"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36", "Mac OS X", "", "Chrome", "Desktop"},
		{"Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36", "Android", "14", "Chrome", "Tablet"},
	} {
		p := telemetry.UserAgent(c.ua)
		osVersion, _ := p["$os_version"].(string)
		if p["$os"] != c.os || osVersion != c.osVersion || p["$browser"] != c.browser || p["$device_type"] != c.device {
			t.Errorf("%s: %v", c.ua, p)
		}
	}
}
