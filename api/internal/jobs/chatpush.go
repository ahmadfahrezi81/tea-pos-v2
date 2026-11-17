package jobs

import (
	"context"
	"errors"
	"log/slog"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/riverqueue/river"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/push"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

// chatPushWait: a push waits this long, so a burst of messages in a channel buzzes once.
const chatPushWait = 10 * time.Second

// ChatPushArgs pushes a channel's newest message to whoever has not read it (RFC: Chat (v2)).
// Queued with each message; one per channel per wait, the rest are the same job.
type ChatPushArgs struct {
	ChannelID string `json:"channel_id" river:"unique"`
}

func (ChatPushArgs) Kind() string { return "chat_push" }

func (ChatPushArgs) InsertOpts() river.InsertOpts {
	return river.InsertOpts{
		MaxAttempts: 3,
		ScheduledAt: time.Now().Add(chatPushWait),
		UniqueOpts:  river.UniqueOpts{ByArgs: true, ByPeriod: chatPushWait},
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
	m, err := w.Queries.LatestChatMessage(ctx, channel)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	// Two jobs for one burst can run together: only the first to claim the message sends it.
	if _, err := w.Queries.ClaimChatPush(ctx, store.ClaimChatPushParams{MessageID: m.ID, ChannelID: channel}); errors.Is(err, pgx.ErrNoRows) {
		return nil
	} else if err != nil {
		return err
	}
	targets, err := w.Queries.ChatPushTargets(ctx, store.ChatPushTargetsParams{
		ChannelID: channel, AuthorID: m.AuthorID, System: m.AuthorType == "system", At: m.CreatedAt,
	})
	if err != nil {
		return err
	}
	for _, t := range targets {
		msg := push.Message{
			Title: chatTitle(m.Kind, m.ChannelName, t.PreferredLanguage),
			Body:  chatBody(m, t.PreferredLanguage),
			Tag:   j.Args.ChannelID,
			URL:   "/" + m.Slug + "/chats/" + j.Args.ChannelID,
		}
		err := w.Push.Send(ctx, push.Subscription{Endpoint: t.Endpoint, P256dh: t.P256dh, Auth: t.Auth}, msg, j.Args.ChannelID)
		switch {
		case errors.Is(err, push.ErrGone):
			if err := w.Queries.DeleteGonePushSubscription(ctx, t.Endpoint); err != nil {
				return err
			}
		case err != nil:
			// One phone's push service failing does not stop the others'.
			slog.WarnContext(ctx, "chat push", "err", err)
		}
	}
	return nil
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
		return "Admin"
	default:
		if en {
			return "Notifications"
		}
		return "Notifikasi"
	}
}

// chatBody is who wrote what, short enough for a lock screen.
func chatBody(m store.LatestChatMessageRow, lang string) string {
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
	if m.AuthorName != "" {
		return m.AuthorName + ": " + text
	}
	return text
}
