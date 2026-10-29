// Package realtime tells the phones that something changed, within a second, in every app.
// The API saves a change and Announces it (a Postgres NOTIFY, sent only if the change
// commits); the hub in cmd/realtime hears it and passes it to the sockets watching that
// topic; the phone refetches what it shows. Writes always go through the API: the hub only
// delivers, and never carries the data itself. Task 017b.
package realtime

import (
	"context"
	"encoding/json"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

// Channel is the Postgres channel the API notifies and the hub listens on.
const Channel = "changes"

// Event is what changed: where (Topic), what kind of thing (Kind), which one (ID). The apps
// map a Kind to the screens that show it.
type Event struct {
	Topic string `json:"topic"`
	Kind  string `json:"kind"`
	ID    string `json:"id,omitempty"`
}

// Kinds this code sends.
const (
	// SignedOut: one of the user's sessions ended; the hub closes that session's sockets and
	// the user's other phones check they are still signed in.
	SignedOut = "signed_out"
	// Resync: the hub may have missed changes (its connection to Postgres dropped); every
	// screen refetches once.
	Resync = "resync"
)

// Topics. A socket may watch only those of its own user, tenants and stores.
func UserTopic(id string) string   { return "user:" + id }
func TenantTopic(id string) string { return "tenant:" + id }
func StoreTopic(id string) string  { return "store:" + id }

// Announce tells the hub about e. With q on a transaction (q.WithTx), it goes out only if the
// transaction commits, so a rolled-back change announces nothing.
func Announce(ctx context.Context, q *store.Queries, e Event) error {
	b, err := json.Marshal(e)
	if err != nil {
		return err
	}
	return q.Notify(ctx, string(b))
}
