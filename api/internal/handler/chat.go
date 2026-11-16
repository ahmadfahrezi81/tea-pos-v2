package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/files"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/idem"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/jobs"
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

// chatPhotoTTL: a signed photo address works this long; the phone keeps it with the page it came in.
const chatPhotoTTL = 6 * time.Hour

// chatLimit: about 30 messages a minute per person, so a stuck phone or a loop cannot flood a channel.
var chatLimit = auth.NewLimiter(30, time.Minute)

// typingLimit: a phone says it is typing at most every 3 seconds; more is dropped quietly.
var typingLimit = auth.NewLimiter(30, time.Minute)

// chatAccess: anyone with a chat level, from either app (RFC: Chat (v2)).
var chatAccess = auth.App(auth.Chat, auth.Member)

func registerChat(api huma.API, d Deps) {
	registerChatTyping(api, d)
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
				return out, attachPhotos(ctx, d, out.Body.Items)
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
			return out, attachPhotos(ctx, d, out.Body.Items)
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
			if body == "" && len(in.Body.Photos) == 0 {
				return nil, errBlankMessage
			}
			// Only photos uploaded into this tenant's own folder.
			for _, p := range in.Body.Photos {
				own := caller.TenantID.String() + "/"
				if !strings.HasPrefix(p.Path, own) || !strings.HasPrefix(p.PreviewPath, own) || strings.Contains(p.Path+p.PreviewPath, "..") {
					return nil, errBadPhoto
				}
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
			for i, p := range in.Body.Photos {
				if err := q.InsertChatPhoto(ctx, store.InsertChatPhotoParams{
					MessageID: row.ID, Position: int16(i), Path: p.Path, PreviewPath: p.PreviewPath,
					Width: int32(p.Width), Height: int32(p.Height),
				}); err != nil {
					return nil, err
				}
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
			// The push, in the same transaction: a message saved is a push that will be tried.
			if tx, ok := idem.Tx(ctx); ok && d.Jobs != nil {
				if err := jobs.Insert(ctx, d.Jobs, tx, jobs.ChatPushArgs{ChannelID: ch.ID.String()}); err != nil {
					return nil, err
				}
			}
			out := &contract.ChatMessageOutput{Body: contract.ChatMessage{
				ID: row.ID.String(), AuthorID: caller.UserID.String(), Author: name, Avatar: avatar,
				Body: body, ClientKey: in.Key, At: nano(row.CreatedAt),
			}}
			items := []contract.ChatMessage{out.Body}
			if len(in.Body.Photos) > 0 {
				photos := make([]store.ChatMessagePhoto, len(in.Body.Photos))
				for i, p := range in.Body.Photos {
					photos[i] = store.ChatMessagePhoto{MessageID: row.ID, Position: int16(i), Path: p.Path, PreviewPath: p.PreviewPath, Width: int32(p.Width), Height: int32(p.Height)}
				}
				signPhotosInto(ctx, d.Files, items, photos)
			}
			out.Body = items[0]
			return out, nil
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

// registerChatTyping: "Budi is typing", passed to the channel's other members through the hub,
// never stored; a missed one is already stale.
func registerChatTyping(api huma.API, d Deps) {
	route(api, huma.Operation{
		OperationID: "chatTyping", Method: http.MethodPost, Path: "/tenants/{tenant}/chat/channels/{id}/typing",
		Summary: "The caller is typing in a channel: its other members are told, nothing is saved", Tags: []string{"chat"},
		DefaultStatus: http.StatusNoContent,
	}, chatAccess.Repeatable(),
		func(ctx context.Context, in *contract.ChatTypingInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			if !typingLimit.Allow(caller.UserID.String()) {
				return nil, nil
			}
			ch, err := chatChannel(ctx, d.Queries, caller, in.ID)
			if err != nil {
				return nil, err
			}
			if readOnly(ch.Kind, ch.StoreStatus) {
				return nil, errChannelReadOnly
			}
			members, err := d.Queries.ListChatMembers(ctx, ch.ID)
			if err != nil {
				return nil, err
			}
			for _, m := range members {
				if m.ID == caller.UserID {
					continue
				}
				e := realtime.Event{Topic: realtime.UserTopic(m.ID.String()), Kind: chatTyping, ID: ch.ID.String(), By: caller.UserID.String()}
				if err := realtime.Announce(ctx, d.Queries, e); err != nil {
					return nil, err
				}
			}
			return nil, nil
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
	// Shown for a few seconds, never refetched.
	chatTyping = "chat_typing"
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

// attachPhotos puts each message's photos on it, every address signed in one batch.
func attachPhotos(ctx context.Context, d Deps, items []contract.ChatMessage) error {
	ids := make([]pgtype.UUID, 0, len(items))
	for _, m := range items {
		var id pgtype.UUID
		if id.Scan(m.ID) == nil {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return nil
	}
	photos, err := d.Queries.ListChatPhotos(ctx, ids)
	if err != nil || len(photos) == 0 {
		return err
	}
	signPhotosInto(ctx, d.Files, items, photos)
	return nil
}

// signPhotosInto signs photos' addresses in one call; one that cannot be signed is left empty.
func signPhotosInto(ctx context.Context, s *files.Storage, items []contract.ChatMessage, photos []store.ChatMessagePhoto) {
	paths := make([]string, 0, 2*len(photos))
	for _, p := range photos {
		paths = append(paths, p.Path, p.PreviewPath)
	}
	signed := map[string]string{}
	if s != nil {
		var err error
		signed, err = s.SignReads(ctx, files.Purposes["chat_photo"].Bucket, paths, chatPhotoTTL)
		if err != nil && !errors.Is(err, files.ErrNotConfigured) {
			slog.WarnContext(ctx, "sign chat photos", "err", err)
		}
	}
	at := map[string]int{}
	for i, m := range items {
		at[m.ID] = i
	}
	for _, p := range photos {
		if i, ok := at[p.MessageID.String()]; ok {
			items[i].Photos = append(items[i].Photos, contract.ChatPhoto{
				URL: signed[p.Path], PreviewURL: signed[p.PreviewPath], Width: int(p.Width), Height: int(p.Height),
			})
		}
	}
}
