// Package chatevent is what chat says by itself (Step 74): one way to post the app's own
// message, inside the transaction of the change it is about, and the events the worker posts.
// A message keeps the event's numbers, never finished text: each phone writes it in its
// reader's language; body is English, for a build that does not know the event yet.
package chatevent

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/realtime"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

// The events. A new one is a constant here, its line in Text, and its line on the phone.
const (
	DaySummary  = "day_summary"
	RainStarted = "rain_started"
	RainStopped = "rain_stopped"
	PayoutPaid  = "payout_paid"
	PayTotal    = "pay_total"
	Release     = "release"
)

// Queue queues the channel's push inside tx (jobs.ChatPushQueue); nil sends none.
type Queue func(ctx context.Context, tx pgx.Tx, channelID string) error

// Where is the channel an event goes to.
type Where struct {
	Kind        string
	Store, User pgtype.UUID
}

func General() Where                    { return Where{Kind: "general"} }
func VIP() Where                        { return Where{Kind: "admin"} }
func Store(id pgtype.UUID) Where        { return Where{Kind: "store", Store: id} }
func Notifications(u pgtype.UUID) Where { return Where{Kind: "personal", User: u} }

// Event is one message of the app's own.
type Event struct {
	Tenant pgtype.UUID
	Where  Where
	Type   string
	Data   map[string]any
	// Key: posted once per channel (a day, a payout); "" posts every time.
	Key string
}

// changed is the hub's kind for a channel with something new (handler's chatChanged).
const changed = "chat"

// Post writes e inside tx and tells the channel's people, then queues its push; false when
// its key was posted already.
func Post(ctx context.Context, tx pgx.Tx, queue Queue, e Event) (bool, error) {
	q := store.New(tx)
	ch, err := q.EnsureChatChannel(ctx, store.EnsureChatChannelParams{
		TenantID: e.Tenant, Kind: e.Where.Kind, StoreID: e.Where.Store, UserID: e.Where.User,
	})
	if err != nil {
		return false, err
	}
	meta, err := json.Marshal(e.Data)
	if err != nil {
		return false, err
	}
	row, err := q.InsertChatEvent(ctx, store.InsertChatEventParams{
		TenantID: e.Tenant, ChannelID: ch, EventType: pgtype.Text{String: e.Type, Valid: true},
		Body: Text(e.Type, e.Data, "en"), Metadata: meta, EventKey: pgtype.Text{String: e.Key, Valid: e.Key != ""},
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if err := q.SetChatChannelLast(ctx, store.SetChatChannelLastParams{MessageID: row.ID, At: row.CreatedAt, ID: ch}); err != nil {
		return false, err
	}
	members, err := q.ListChatMembers(ctx, ch)
	if err != nil {
		return false, err
	}
	for _, m := range members {
		if err := realtime.Announce(ctx, q, realtime.Event{Topic: realtime.UserTopic(m.ID.String()), Kind: changed, ID: ch.String()}); err != nil {
			return false, err
		}
	}
	if queue != nil {
		if err := queue(ctx, tx, ch.String()); err != nil {
			return false, err
		}
	}
	return true, nil
}
