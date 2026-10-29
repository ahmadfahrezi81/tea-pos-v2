// Package telemetry is PostHog, only from Go: errors, the apps' events, and flags evaluated in
// memory. The phones never load PostHog. A nil *Client sends nothing and every flag is off.
package telemetry

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/posthog/posthog-go"
)

type Client struct {
	ph       posthog.Client
	hasFlags bool
}

type Config struct {
	Key, FlagsKey, Host string
	FlagsPoll           time.Duration
}

// New is nil without a key (local, tests).
func New(c Config) (*Client, error) {
	if c.Key == "" {
		return nil, nil
	}
	ph, err := posthog.NewWithConfig(c.Key, posthog.Config{
		Endpoint:                           c.Host,
		SecretKey:                          c.FlagsKey,
		DefaultFeatureFlagsPollingInterval: c.FlagsPoll,
		// The newer protocol only fills in what an event lacks, so the phone's $os (from /events)
		// is kept; the default one overwrites it with the server's (Linux).
		CaptureMode: posthog.CaptureModeAnalyticsV1,
		Logger:      quietLogger{},
	})
	if err != nil {
		return nil, err
	}
	return &Client{ph: ph, hasFlags: c.FlagsKey != ""}, nil
}

// Enqueuer is for the log handler that sends logged errors; nil when off.
func (c *Client) Enqueuer() posthog.EnqueueClient {
	if c == nil {
		return nil
	}
	return c.ph
}

// Capture sends an event in the background; it never blocks the request.
func (c *Client) Capture(distinctID, event string, props map[string]any, at time.Time) {
	if c == nil {
		return
	}
	_ = c.ph.Enqueue(posthog.Capture{DistinctId: distinctID, Event: event, Properties: props, Timestamp: at})
}

// Exception sends an error from an app in PostHog's error tracking shape; frames (ParseStack)
// let PostHog read it through the uploaded source maps.
func (c *Client) Exception(distinctID, kind, message string, frames []Frame, props map[string]any, at time.Time) {
	if c == nil {
		return
	}
	if kind == "" {
		kind = "Error"
	}
	item := map[string]any{
		"type":      kind,
		"value":     message,
		"mechanism": map[string]any{"type": "generic", "handled": false, "synthetic": false},
	}
	if len(frames) > 0 {
		item["stacktrace"] = map[string]any{"type": "raw", "frames": frames}
	}
	p := posthog.NewProperties().Merge(props).Set("$exception_list", []any{item})
	_ = c.ph.Enqueue(posthog.Capture{DistinctId: distinctID, Event: "$exception", Properties: p, Timestamp: at})
}

// Enabled is one flag for one user, from the rules in memory: no network call, ever.
func (c *Client) Enabled(key, distinctID string, props map[string]any) bool {
	if c == nil || !c.hasFlags {
		return false
	}
	on, err := c.ph.IsFeatureEnabled(posthog.FeatureFlagPayload{
		Key:                   key,
		DistinctId:            distinctID,
		PersonProperties:      props,
		OnlyEvaluateLocally:   true,
		SendFeatureFlagEvents: posthog.Ptr(false),
	})
	b, _ := on.(bool)
	return err == nil && b
}

// All is every flag that is on for a user, for /me.
func (c *Client) All(distinctID string, props map[string]any) map[string]bool {
	out := map[string]bool{}
	if c == nil || !c.hasFlags {
		return out
	}
	all, err := c.ph.GetAllFlags(posthog.FeatureFlagPayloadNoKey{
		DistinctId:            distinctID,
		PersonProperties:      props,
		OnlyEvaluateLocally:   true,
		SendFeatureFlagEvents: posthog.Ptr(false),
	})
	if err != nil {
		return out
	}
	for k, v := range all {
		// A multivariate flag's value is its variant's name: on.
		if on, ok := v.(bool); ok && on {
			out[k] = true
		} else if s, ok := v.(string); ok && s != "" {
			out[k] = true
		}
	}
	return out
}

// Close sends what is queued; called on shutdown.
func (c *Client) Close() {
	if c != nil {
		_ = c.ph.Close()
	}
}

// quietLogger puts PostHog's own messages in our log, its errors as warnings: logged errors are
// sent to PostHog, and a failing PostHog would feed itself.
type quietLogger struct{}

func (quietLogger) Debugf(string, ...any) {}
func (quietLogger) Logf(f string, a ...any) {
	slog.Debug("posthog", "msg", fmt.Sprintf(f, a...))
}
func (quietLogger) Warnf(f string, a ...any) {
	slog.Warn("posthog", "msg", fmt.Sprintf(f, a...))
}
func (quietLogger) Errorf(f string, a ...any) {
	slog.Warn("posthog", "msg", fmt.Sprintf(f, a...))
}
