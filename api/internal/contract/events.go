package contract

import "time"

// EventsInput is a batch of what an app saw, sent on to PostHog by Go: the phones never load PostHog.
type EventsInput struct {
	Body struct {
		Events []AppEvent `json:"events" minItems:"1" maxItems:"50" nullable:"false"`
	}
}

type AppEvent struct {
	Type string    `json:"type" enum:"error,pageview"`
	Path string    `json:"path" maxLength:"300" example:"/test-a/home"`
	At   time.Time `json:"at" doc:"The phone's clock; Go uses its own when this is far off"`
	// For errors.
	Name    string `json:"name,omitempty" maxLength:"200" example:"TypeError"`
	Message string `json:"message,omitempty" maxLength:"2000"`
	Stack   string `json:"stack,omitempty" maxLength:"8000"`
}
