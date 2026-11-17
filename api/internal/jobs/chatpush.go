package jobs

import (
	"context"
	"errors"
	"log/slog"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivertype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/push"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

// chatPushRounds: a job sends what is new, then looks again (a message saved while it ran was
// folded into it); a few rounds at most.
const chatPushRounds = 5

// ChatPushArgs pushes a channel's newest message to whoever has not read it (RFC: Chat (v2)).
// Queued with each message and run at once: a job waiting to merge a burst was picked up only
// by the worker's once-a-minute poll, so pushes came up to a minute late (task 068c). While one
// waits or runs, another message's job is the same job; finished ones do not count.
type ChatPushArgs struct {
	ChannelID string `json:"channel_id" river:"unique"`
}

func (ChatPushArgs) Kind() string { return "chat_push" }

func (ChatPushArgs) InsertOpts() river.InsertOpts {
	return river.InsertOpts{
		MaxAttempts: 3,
		UniqueOpts: river.UniqueOpts{ByArgs: true, ByState: []rivertype.JobState{
			rivertype.JobStateAvailable, rivertype.JobStatePending, rivertype.JobStateRunning,
			rivertype.JobStateScheduled, rivertype.JobStateRetryable,
		}},
	}
}

type ChatPushWorker struct {
	river.WorkerDefaults[ChatPushArgs]
	Queries *store.Queries
	Push    *push.Sender
}

func (w *ChatPushWorker) Work(ctx context.Context, j *river.Job[ChatPushArgs]) error {
	if w.Push == nil {
		return nil
	}
	var channel pgtype.UUID
	if err := channel.Scan(j.Args.ChannelID); err != nil {
		return river.JobCancel(err)
	}
	for range chatPushRounds {
		sent, err := w.pushNewest(ctx, channel, j.Args.ChannelID)
		if err != nil || !sent {
			return err
		}
	}
	return nil
}

// pushNewest pushes the channel's newest message, unless a job already did; whether it sent.
func (w *ChatPushWorker) pushNewest(ctx context.Context, channel pgtype.UUID, channelID string) (bool, error) {
	m, err := w.Queries.LatestChatMessage(ctx, channel)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	// Two jobs for one burst can run together: only the first to claim the message sends it.
	if _, err := w.Queries.ClaimChatPush(ctx, store.ClaimChatPushParams{MessageID: m.ID, ChannelID: channel}); errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	} else if err != nil {
		return false, err
	}
	targets, err := w.Queries.ChatPushTargets(ctx, store.ChatPushTargetsParams{
		ChannelID: channel, AuthorID: m.AuthorID, System: m.AuthorType == "system", At: m.CreatedAt,
	})
	if err != nil {
		return false, err
	}
	for _, t := range targets {
		msg := push.Message{
			Title: pushTitle(m, t.PreferredLanguage),
			Body:  pushBody(m, t.PreferredLanguage),
			Tag:   channelID,
			URL:   "/" + m.Slug + "/chats/" + channelID,
			Icon:  m.AuthorAvatar,
		}
		err := w.Push.Send(ctx, push.Subscription{Endpoint: t.Endpoint, P256dh: t.P256dh, Auth: t.Auth}, msg, channelID)
		switch {
		case errors.Is(err, push.ErrGone):
			if err := w.Queries.DeleteGonePushSubscription(ctx, t.Endpoint); err != nil {
				return false, err
			}
		case err != nil:
			// One phone's push service failing does not stop the others'.
			slog.WarnContext(ctx, "chat push", "err", err)
		}
	}
	return true, nil
}

// chatTitle is the channel as the reader's app names it; Indonesian unless they chose English.
func chatTitle(kind, name, lang string) string {
	if name != "" {
		return name
	}
	en := lang == "en"
	switch kind {
	case "general":
		if en {
			return "General"
		}
		return "Umum"
	case "admin":
		return "VIP"
	default:
		if en {
			return "Notifications"
		}
		return "Notifikasi"
	}
}

// pushTitle is who wrote it, as WhatsApp and Slack; the app's own messages are titled by their chat.
func pushTitle(m store.LatestChatMessageRow, lang string) string {
	if m.AuthorName != "" {
		return m.AuthorName
	}
	return chatTitle(m.Kind, m.ChannelName, lang)
}

// pushBody is the chat (#General, #a store) on its first line, the message under it, short
// enough for a lock screen. A web notification has only a title and a text.
func pushBody(m store.LatestChatMessageRow, lang string) string {
	text := m.Body
	if text == "" && m.Photos > 0 {
		text = "📷 Foto"
		if lang == "en" {
			text = "📷 Photo"
		}
	}
	if utf8.RuneCountInString(text) > 180 {
		text = string([]rune(text)[:180]) + "…"
	}
	if m.AuthorName == "" {
		return text
	}
	return "#" + chatTitle(m.Kind, m.ChannelName, lang) + "\n" + text
}
