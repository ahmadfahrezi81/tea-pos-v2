package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/idem"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/page"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/realtime"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

var (
	// A channel the caller is not in answers as one that does not exist: nothing about it leaks.
	errChannelNotFound = httpx.New(http.StatusNotFound, "channel_not_found", "That chat was not found")
	errChannelReadOnly = httpx.New(http.StatusForbidden, "channel_read_only", "Nobody can post in this chat")
	errBlankMessage    = httpx.New(http.StatusUnprocessableEntity, "blank_message", "Write something first")
	errChatTooFast     = httpx.New(http.StatusTooManyRequests, "chat_too_fast", "Too many messages, wait a moment")
	errBadReadTime     = httpx.New(http.StatusBadRequest, "bad_request", "Not a time")
)

// chatLimit: about 30 messages a minute per person, so a stuck phone or a loop cannot flood a channel.
var chatLimit = auth.NewLimiter(30, time.Minute)

// chatAccess: anyone with a chat level, from either app (RFC: Chat (v2)).
var chatAccess = auth.App(auth.Chat, auth.Member)

func registerChat(api huma.API, d Deps) {
	op := func(id, method, path, summary string) huma.Operation {
		return huma.Operation{OperationID: id, Method: method, Path: "/tenants/{tenant}/chat" + path, Summary: summary, Tags: []string{"chat"}}
	}

	route(api, op("listChatChannels", http.MethodGet, "/channels", "The caller's channels, made first if missing"), chatAccess,
		func(ctx context.Context, _ *contract.TenantInput) (*contract.ChatChannelsOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			admin := caller.ChatLevel == auth.Admin
			// Made on demand, never seeded: nothing to keep in step with v1's stores and people.
			if err := d.Queries.EnsureChatChannels(ctx, store.EnsureChatChannelsParams{
				UserID: caller.UserID, ChatAdmin: admin, TenantID: caller.TenantID,
			}); err != nil {
				return nil, err
			}
			rows, err := d.Queries.ListChatChannels(ctx, store.ListChatChannelsParams{
				UserID: caller.UserID, TenantID: caller.TenantID, ChatAdmin: admin,
			})
			if err != nil {
				return nil, err
			}
			out := &contract.ChatChannelsOutput{}
			out.Body.Channels = make([]contract.ChatChannel, len(rows))
			for i, r := range rows {
				c := contract.ChatChannel{
					ID: r.ID.String(), Kind: r.Kind, Name: r.Name, Unread: int(r.Unread),
					ReadOnly: readOnly(r.Kind, r.StoreStatus),
				}
				if r.LastMessageAt.Valid {
					c.LastAt = nano(r.LastMessageAt)
					c.Last = &contract.ChatPreview{
						Mine: r.LastMine, Author: r.LastAuthor, Body: r.LastBody, Deleted: r.LastDeleted,
					}
					if r.LastAuthorType == "system" {
						c.Last.Event, c.Last.Data = r.LastEventType, data(r.LastMetadata)
					}
					if r.LastDeleted {
						c.Last.Body = ""
					}
				}
				out.Body.Channels[i] = c
			}
			return out, nil
		})

	route(api, op("getChatChannel", http.MethodGet, "/channels/{id}", "One channel and its members, with how far each has read"), chatAccess,
		func(ctx context.Context, in *contract.ChatChannelInput) (*contract.ChatChannelOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			ch, err := chatChannel(ctx, d.Queries, caller, in.ID)
			if err != nil {
				return nil, err
			}
			members, err := d.Queries.ListChatMembers(ctx, ch.ID)
			if err != nil {
				return nil, err
			}
			out := &contract.ChatChannelOutput{}
			out.Body.ChatChannel = contract.ChatChannel{
				ID: ch.ID.String(), Kind: ch.Kind, Name: ch.Name, ReadOnly: readOnly(ch.Kind, ch.StoreStatus),
			}
			out.Body.Members = make([]contract.ChatMember, len(members))
			for i, m := range members {
				out.Body.Members[i] = contract.ChatMember{
					ID: m.ID.String(), Name: m.FullName, Avatar: m.AvatarUrl, ReadAt: readAt(m.LastReadAt),
				}
			}
			return out, nil
		})
	route(api, op("listChatMessages", http.MethodGet, "/channels/{id}/messages", "A page of messages, newest first; with since, only what came after"), chatAccess,
		func(ctx context.Context, in *contract.ChatMessagesInput) (*contract.ChatMessagesOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			ch, err := chatChannel(ctx, d.Queries, caller, in.ID)
			if err != nil {
				return nil, err
			}
			out := &contract.ChatMessagesOutput{}
			if !in.Since.IsZero() {
				rows, err := d.Queries.ListChatMessagesSince(ctx, store.ListChatMessagesSinceParams{
					ChannelID: ch.ID, Since: pgtype.Timestamptz{Time: in.Since, Valid: true},
				})
				if err != nil {
					return nil, err
				}
				out.Body.Items = make([]contract.ChatMessage, len(rows))
				for i, r := range rows {
					out.Body.Items[i] = chatMessage(store.ListChatMessagesRow(r))
				}
				return out, nil
			}
			cursor, err := page.Decode(in.Cursor)
			if err != nil {
				return nil, errBadCursor
			}
			rows, err := d.Queries.ListChatMessages(ctx, store.ListChatMessagesParams{
				ChannelID: ch.ID, CursorAt: pgtype.Timestamptz{Time: cursor.At, Valid: true}, CursorID: cursor.ID,
				Lim: int32(in.Limit + 1),
			})
			if err != nil {
				return nil, err
			}
			out.Body = page.Map(page.Rows(rows, in.Limit, func(r store.ListChatMessagesRow) page.Cursor {
				return page.Cursor{At: r.CreatedAt.Time, ID: r.ID}
			}), chatMessage)
			return out, nil
		})

	route(api, huma.Operation{
		OperationID: "postChatMessage", Method: http.MethodPost, Path: "/tenants/{tenant}/chat/channels/{id}/messages",
		Summary: "Post a message; the same Idempotency-Key never posts twice", Tags: []string{"chat"},
	}, chatAccess.Idempotent(),
		func(ctx context.Context, in *contract.PostChatMessageInput) (*contract.ChatMessageOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			if !chatLimit.Allow(caller.UserID.String()) {
				return nil, errChatTooFast
			}
			body := strings.TrimSpace(in.Body.Body)
			if body == "" {
				return nil, errBlankMessage
			}
			q := idem.Queries(ctx, d.Queries)
			ch, err := chatChannel(ctx, q, caller, in.ID)
			if err != nil {
				return nil, err
			}
			if readOnly(ch.Kind, ch.StoreStatus) {
				return nil, errChannelReadOnly
			}
			row, err := q.InsertChatMessage(ctx, store.InsertChatMessageParams{
				TenantID: caller.TenantID, ChannelID: ch.ID, AuthorID: caller.UserID, Body: body,
				ClientKey: pgtype.Text{String: in.Key, Valid: in.Key != ""},
			})
			if err != nil {
				return nil, err
			}
			if err := q.SetChatChannelLast(ctx, store.SetChatChannelLastParams{MessageID: row.ID, At: row.CreatedAt, ID: ch.ID}); err != nil {
				return nil, err
			}
			// The author has read their own message.
			if _, err := q.MarkChatRead(ctx, store.MarkChatReadParams{UserID: caller.UserID, ChannelID: ch.ID, At: row.CreatedAt}); err != nil {
				return nil, err
			}
			members, err := q.ListChatMembers(ctx, ch.ID)
			if err != nil {
				return nil, err
			}
			ids := make([]pgtype.UUID, len(members))
			var name, avatar string
			for i, m := range members {
				ids[i] = m.ID
				if m.ID == caller.UserID {
					name, avatar = m.FullName, m.AvatarUrl
				}
			}
			// On each member's own topic: the hub needs no chat topics, and only members hear of it.
			if err := announceChat(ctx, q, chatChanged, ch.ID, ids); err != nil {
				return nil, err
			}
			return &contract.ChatMessageOutput{Body: contract.ChatMessage{
				ID: row.ID.String(), AuthorID: caller.UserID.String(), Author: name, Avatar: avatar,
				Body: body, ClientKey: in.Key, At: nano(row.CreatedAt),
			}}, nil
		})

	route(api, huma.Operation{
		OperationID: "readChat", Method: http.MethodPost, Path: "/tenants/{tenant}/chat/channels/{id}/read",
		Summary: "Everything up to a time is read; only ever moves forward", Tags: []string{"chat"},
		DefaultStatus: http.StatusNoContent,
	}, chatAccess.Repeatable(),
		func(ctx context.Context, in *contract.ReadChatInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			ch, err := chatChannel(ctx, d.Queries, caller, in.ID)
			if err != nil {
				return nil, err
			}
			at, err := time.Parse(time.RFC3339Nano, in.Body.At)
			if err != nil {
				return nil, errBadReadTime
			}
			if now := time.Now(); at.After(now) {
				at = now
			}
			until := pgtype.Timestamptz{Time: at, Valid: true}
			was, err := d.Queries.MarkChatRead(ctx, store.MarkChatReadParams{UserID: caller.UserID, ChannelID: ch.ID, At: until})
			if err != nil {
				return nil, err
			}
			if was.InfinityModifier == pgtype.Finite && !at.After(was.Time) {
				return nil, nil
			}
			// Only the people whose messages were just read: their Seen by changed.
			authors, err := d.Queries.ChatAuthorsBetween(ctx, store.ChatAuthorsBetweenParams{
				ChannelID: ch.ID, ReaderID: caller.UserID, After: was, Until: until,
			})
			if err != nil {
				return nil, err
			}
			if err := announceChat(ctx, d.Queries, chatRead, ch.ID, authors); err != nil {
				return nil, err
			}
			// The reader's other phones: their count goes down too.
			return nil, announceChat(ctx, d.Queries, chatChanged, ch.ID, []pgtype.UUID{caller.UserID})
		})
}

// chatChannel is one channel, only if the caller is in it.
func chatChannel(ctx context.Context, q *store.Queries, caller auth.Caller, id string) (store.GetChatChannelRow, error) {
	cid, err := uuid(id, errChannelNotFound)
	if err != nil {
		return store.GetChatChannelRow{}, err
	}
	ch, err := q.GetChatChannel(ctx, store.GetChatChannelParams{
		ID: cid, TenantID: caller.TenantID, ChatAdmin: caller.ChatLevel == auth.Admin, UserID: caller.UserID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return ch, errChannelNotFound
	}
	return ch, err
}

// readOnly: the system's inbox, or a store no longer open; its history stays readable.
func readOnly(kind, storeStatus string) bool {
	return kind == "personal" || (kind == "store" && storeStatus == "inactive")
}

func data(raw []byte) map[string]any {
	var m map[string]any
	if len(raw) == 0 || json.Unmarshal(raw, &m) != nil || len(m) == 0 {
		return nil
	}
	return m
}

// readAt is how far someone has read; "" when they never opened the channel.
func readAt(t pgtype.Timestamptz) string {
	if !t.Valid || t.InfinityModifier != pgtype.Finite {
		return ""
	}
	return nano(t)
}

// nano is a chat time to the microsecond: messages and read marks are compared at that precision.
func nano(t pgtype.Timestamptz) string {
	if !t.Valid {
		return ""
	}
	return t.Time.UTC().Format(time.RFC3339Nano)
}

// Live update kinds: the apps refetch the queries whose meta.live names them.
const (
	chatChanged = "chat"
	chatRead    = "chat_read"
)

func announceChat(ctx context.Context, q *store.Queries, kind string, channel pgtype.UUID, users []pgtype.UUID) error {
	for _, u := range users {
		e := realtime.Event{Topic: realtime.UserTopic(u.String()), Kind: kind, ID: channel.String()}
		if err := realtime.Announce(ctx, q, e); err != nil {
			return err
		}
	}
	return nil
}

func chatMessage(r store.ListChatMessagesRow) contract.ChatMessage {
	m := contract.ChatMessage{ID: r.ID.String(), Body: r.Body, At: nano(r.CreatedAt), EditedAt: nano(r.EditedAt)}
	if r.AuthorID.Valid {
		m.AuthorID, m.Author, m.Avatar = r.AuthorID.String(), r.AuthorName, r.AuthorAvatar
	}
	if r.AuthorType == "system" {
		m.Event, m.Data = r.EventType.String, data(r.Metadata)
	}
	if r.ClientKey.Valid {
		m.ClientKey = r.ClientKey.String
	}
	if r.DeletedAt.Valid {
		m.Deleted, m.Body = true, ""
	}
	return m
}
