package domain

import "strings"

// Device names a phone or computer from its user agent, as a person would: "iPhone · Safari",
// "Android · Chrome". "" when nothing is known. An iPad asking for the desktop site says Mac.
func Device(userAgent string) string {
	ua := userAgent
	has := func(s string) bool { return strings.Contains(ua, s) }
	var system string
	switch {
	case has("iPhone"):
		system = "iPhone"
	case has("iPad"):
		system = "iPad"
	case has("Android"):
		system = "Android"
	case has("CrOS"):
		system = "Chromebook"
	case has("Macintosh"):
		system = "Mac"
	case has("Windows"):
		system = "Windows"
	case has("Linux"):
		system = "Linux"
	}
	var browser string
	switch {
	case has("SamsungBrowser"):
		browser = "Samsung Internet"
	case has("EdgA/"), has("EdgiOS/"), has("Edg/"):
		browser = "Edge"
	case has("FxiOS/"), has("Firefox/"):
		browser = "Firefox"
	case has("OPR/"), has("OPiOS/"):
		browser = "Opera"
	case has("CriOS/"), has("Chrome/"):
		browser = "Chrome"
	case has("Safari/"), system == "iPhone" || system == "iPad":
		browser = "Safari"
	}
	switch {
	case system != "" && browser != "":
		return system + " · " + browser
	case system != "":
		return system
	}
	return browser
}
