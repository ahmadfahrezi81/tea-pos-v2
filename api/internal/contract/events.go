package contract

import "time"

// EventsInput is a batch of what an app saw, sent on to PostHog by Go: the phones never load PostHog.
type EventsInput struct {
	UserAgent string `header:"User-Agent"`
	Body      struct {
		Events []AppEvent `json:"events" minItems:"1" maxItems:"50" nullable:"false"`
		// A UUIDv7, new after 30 minutes without use (PostHog's web analytics counts visits by it).
		Session string `json:"session" format:"uuid"`
		Device  Device `json:"device"`
	}
}

type AppEvent struct {
	Type string    `json:"type" enum:"error,pageview,pageleave,app_ready"`
	Path string    `json:"path" maxLength:"300" example:"/test-a/home"`
	At   time.Time `json:"at" doc:"The phone's clock; Go uses its own when this is far off"`
	// For errors.
	Name    string `json:"name,omitempty" maxLength:"200" example:"TypeError"`
	Message string `json:"message,omitempty" maxLength:"2000"`
	Stack   string `json:"stack,omitempty" maxLength:"8000"`
	// Chunks maps each file in the stack to its chunk id (pages.yml injects them), for PostHog's source maps.
	Chunks map[string]string `json:"chunks,omitempty"`
	// For app_ready.
	Ready *AppReady `json:"ready,omitempty"`
}

// AppReady is how long one page load took to become usable: the tea-pos:ready mark, the
// one pnpm bench reads, from the start of the load.
type AppReady struct {
	ReadyMs float64 `json:"readyMs" minimum:"0"`
	HTMLMs  float64 `json:"htmlMs" minimum:"0" doc:"The page's first byte (responseStart)"`
	JSMs    float64 `json:"jsMs" minimum:"0" doc:"The main script done (domContentLoadedEventEnd)"`
	PaintMs float64 `json:"paintMs" minimum:"0" doc:"First paint: the splash (first-contentful-paint)"`
	Open    string  `json:"open" enum:"network,saved,update" doc:"network: no service worker yet; saved: from its copy; update: the first open of a new version"`
	Me      string  `json:"me" enum:"saved,network,none" doc:"Whether the first screen drew /me from the phone's copy; none on sign-in"`
	Screen  string  `json:"screen" enum:"shell,signin,other"`
	Hidden  bool    `json:"hidden" doc:"Hidden at some moment before ready: the time is not the app's"`
}

// Device is the phone, once per batch. Every field is optional: browsers tell different things.
type Device struct {
	ScreenWidth  int     `json:"screenWidth,omitempty"`
	ScreenHeight int     `json:"screenHeight,omitempty"`
	Net          string  `json:"net,omitempty" maxLength:"10" example:"4g" doc:"navigator.connection.effectiveType"`
	RTT          int     `json:"rtt,omitempty" doc:"ms"`
	Downlink     float64 `json:"downlink,omitempty" doc:"Mbit/s"`
	SaveData     bool    `json:"saveData,omitempty"`
	Memory       float64 `json:"memory,omitempty" doc:"GB, navigator.deviceMemory (rounded by the browser)"`
	Cores        int     `json:"cores,omitempty"`
	Model        string  `json:"model,omitempty" maxLength:"60" example:"SM-M115F" doc:"Android Chrome's client hints"`
	OSVersion    string  `json:"osVersion,omitempty" maxLength:"20"`
}
