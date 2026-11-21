package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/chatevent"
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
	errMessageNotFound = httpx.New(http.StatusNotFound, "message_not_found", "That message was not found")
	errNotYourMessage  = httpx.New(http.StatusForbidden, "not_your_message", "Only its author or a chat admin can delete it")
	errNotAuthor       = httpx.New(http.StatusForbidden, "not_author", "Only its author can edit it")
	errEditClosed      = httpx.New(http.StatusUnprocessableEntity, "edit_closed", "A message can be edited for 15 minutes")
)

// editWindow: a message can be edited this long after it is sent (RFC: Chat (v2)).
const editWindow = 15 * time.Minute

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
	registerChatGroups(api, d)
	op := func(id, method, path, summary string) huma.Operation {
		return huma.Operation{OperationID: id, Method: method, Path: "/tenants/{tenant}/chat" + path, Summary: summary, Tags: []string{"chat"}}
	}

	route(api, op("listChatChannels", http.MethodGet, "/channels", "The caller's channels, made first if missing"), chatAccess,
		func(ctx context.Context, _ *contract.TenantInput) (*contract.ChatChannelsOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			vip, admin := caller.ChatLevel.AtLeast(auth.VIP), caller.ChatLevel == auth.Admin
			// Made on demand, never seeded: nothing to keep in step with v1's stores and people.
			if err := d.Queries.EnsureChatChannels(ctx, store.EnsureChatChannelsParams{
				UserID: caller.UserID, ChatVip: vip, TenantID: caller.TenantID, ChatAdmin: admin,
			}); err != nil {
				return nil, err
			}
			rows, err := d.Queries.ListChatChannels(ctx, store.ListChatChannelsParams{
				UserID: caller.UserID, TenantID: caller.TenantID, ChatVip: vip, ChatAdmin: admin,
			})
			if err != nil {
				return nil, err
			}
			out := &contract.ChatChannelsOutput{}
			out.Body.Channels = make([]contract.ChatChannel, len(rows))
			for i, r := range rows {
				c := contract.ChatChannel{
					ID: r.ID.String(), Kind: r.Kind, Name: r.Name, Unread: int(r.Unread), Members: int(r.Members),
					ReadOnly: readOnly(r.Kind, r.StoreStatus, r.Archived),
					Mine:     r.Member || r.Following, Following: r.Following && !r.Member, Archived: r.Archived,
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
				ID: ch.ID.String(), Kind: ch.Kind, Name: ch.Name, ReadOnly: readOnly(ch.Kind, ch.StoreStatus, ch.Archived),
				Mine: ch.Member || ch.Following, Following: ch.Following && !ch.Member, Archived: ch.Archived,
			}
			out.Body.Members = make([]contract.ChatMember, len(members))
			for i, m := range members {
				out.Body.Members[i] = contract.ChatMember{
					ID: m.ID.String(), Name: m.FullName, Avatar: m.AvatarUrl, ReadAt: readAt(m.LastReadAt),
					Admin: m.ChatAdmin, VIP: m.ChatVip, Follower: m.Follower,
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
				if err := resolveLinks(ctx, d.Queries, caller, out.Body.Items); err != nil {
					return nil, err
				}
				return out, attachExtras(ctx, d, out.Body.Items, caller.UserID)
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
			if err := resolveLinks(ctx, d.Queries, caller, out.Body.Items); err != nil {
				return nil, err
			}
			return out, attachExtras(ctx, d, out.Body.Items, caller.UserID)
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
			if body == "" && len(in.Body.Photos) == 0 && in.Body.Link == nil {
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
			if readOnly(ch.Kind, ch.StoreStatus, ch.Archived) {
				return nil, errChannelReadOnly
			}
			var link *chatevent.Link
			if in.Body.Link != nil {
				l, err := sharedLink(ctx, q, caller, in.Body.Link)
				if err != nil {
					return nil, err
				}
				link = &l
			}
			meta, err := linkMetadata(link)
			if err != nil {
				return nil, err
			}
			// A reply answers a message of this same channel, never one elsewhere.
			var replyTo pgtype.UUID
			if in.Body.ReplyTo != "" {
				m, err := chatMessageIn(ctx, q, ch.ID, in.Body.ReplyTo)
				if err != nil {
					return nil, err
				}
				replyTo = m.ID
			}
			row, err := q.InsertChatMessage(ctx, store.InsertChatMessageParams{
				TenantID: caller.TenantID, ChannelID: ch.ID, AuthorID: caller.UserID, Body: body,
				ClientKey: pgtype.Text{String: in.Key, Valid: in.Key != ""}, ReplyTo: replyTo, Metadata: meta,
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
			// A chat admin writing in a channel they are not in follows it, so they hear the answer.
			if !ch.Member && !ch.Following {
				if err := q.SetChatFollow(ctx, store.SetChatFollowParams{UserID: caller.UserID, ChannelID: ch.ID, Follow: true}); err != nil {
					return nil, err
				}
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
			if replyTo.Valid {
				// The phone fetches the quote with the page; its own copy already shows it.
				out.Body.ReplyTo = &contract.ChatQuote{ID: replyTo.String()}
			}
			if link != nil {
				out.Body.Link = &contract.ChatLink{Kind: link.Kind, ID: link.ID}
			}
			items := []contract.ChatMessage{out.Body}
			if err := resolveLinks(ctx, q, caller, items); err != nil {
				return nil, err
			}
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
		OperationID: "deleteChatMessage", Method: http.MethodDelete, Path: "/tenants/{tenant}/chat/channels/{id}/messages/{message}",
		Summary: "Delete a message: its author, or a chat admin; a deleted line stays", Tags: []string{"chat"},
		DefaultStatus: http.StatusNoContent,
	}, chatAccess.Repeatable(),
		func(ctx context.Context, in *contract.ChatMessageInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			ch, err := chatChannel(ctx, d.Queries, caller, in.ID)
			if err != nil {
				return nil, err
			}
			m, err := chatMessageIn(ctx, d.Queries, ch.ID, in.Msg)
			if err != nil {
				return nil, err
			}
			if m.DeletedAt.Valid {
				return nil, nil
			}
			if m.AuthorID != caller.UserID && caller.ChatLevel != auth.Admin {
				return nil, errNotYourMessage
			}
			if err := d.Queries.DeleteChatMessage(ctx, m.ID); err != nil {
				return nil, err
			}
			return nil, announceMembers(ctx, d.Queries, ch.ID)
		})

	route(api, op("listChatActivity", http.MethodGet, "/activity", "Every message from others across the caller's channels, newest first; replies to them marked"), chatAccess,
		func(ctx context.Context, in *contract.ChatActivityInput) (*contract.ChatActivityOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			vip, admin := caller.ChatLevel.AtLeast(auth.VIP), caller.ChatLevel == auth.Admin
			cursor, err := page.Decode(in.Cursor)
			if err != nil {
				return nil, errBadCursor
			}
			rows, err := d.Queries.ListChatActivity(ctx, store.ListChatActivityParams{
				UserID: caller.UserID, TenantID: caller.TenantID, ChatVip: vip, ChatAdmin: admin,
				CursorAt: pgtype.Timestamptz{Time: cursor.At, Valid: true}, CursorID: cursor.ID, Lim: int32(in.Limit + 1),
			})
			if err != nil {
				return nil, err
			}
			out := &contract.ChatActivityOutput{}
			out.Body.Output = page.Map(page.Rows(rows, in.Limit, func(r store.ListChatActivityRow) page.Cursor {
				return page.Cursor{At: r.CreatedAt.Time, ID: r.ID}
			}), func(r store.ListChatActivityRow) contract.ChatActivity {
				return contract.ChatActivity{
					ChatMessage: chatMessage(store.ListChatMessagesRow{
						ID: r.ID, AuthorType: r.AuthorType, AuthorID: r.AuthorID, AuthorName: r.AuthorName,
						AuthorAvatar: r.AuthorAvatar, EventType: r.EventType, Body: r.Body, Metadata: r.Metadata,
						EditedAt: r.EditedAt, CreatedAt: r.CreatedAt,
					}),
					ChannelID: r.ChannelID.String(), ChannelKind: r.ChannelKind, ChannelName: r.ChannelName, Unread: r.Unread, ToMe: r.ToMe,
					MentionsMe: r.MentionsMe,
				}
			})
			// A photo shows as a small preview on its row, not the word Photo.
			msgs := make([]contract.ChatMessage, len(out.Body.Items))
			for i, x := range out.Body.Items {
				msgs[i] = x.ChatMessage
			}
			if err := attachPhotos(ctx, d, msgs); err != nil {
				return nil, err
			}
			for i := range out.Body.Items {
				out.Body.Items[i].Photos = msgs[i].Photos
			}
			if in.Cursor == "" {
				n, err := d.Queries.CountChatActivityUnread(ctx, store.CountChatActivityUnreadParams{
					UserID: caller.UserID, TenantID: caller.TenantID, ChatVip: vip, ChatAdmin: admin,
				})
				if err != nil {
					return nil, err
				}
				out.Body.Unread = int(n)
			}
			return out, nil
		})

	route(api, huma.Operation{
		OperationID: "editChatMessage", Method: http.MethodPatch, Path: "/tenants/{tenant}/chat/channels/{id}/messages/{message}",
		Summary: "Edit one's own message within 15 minutes; never pushes", Tags: []string{"chat"},
	}, chatAccess.Repeatable(),
		func(ctx context.Context, in *contract.EditChatMessageInput) (*contract.ChatMessageOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			ch, err := chatChannel(ctx, d.Queries, caller, in.ID)
			if err != nil {
				return nil, err
			}
			if readOnly(ch.Kind, ch.StoreStatus, ch.Archived) {
				return nil, errChannelReadOnly
			}
			m, err := chatMessageIn(ctx, d.Queries, ch.ID, in.Msg)
			if err != nil {
				return nil, err
			}
			if m.DeletedAt.Valid {
				return nil, errMessageNotFound
			}
			if m.AuthorID != caller.UserID {
				return nil, errNotAuthor
			}
			if time.Since(m.CreatedAt.Time) > editWindow {
				return nil, errEditClosed
			}
			body := strings.TrimSpace(in.Body.Body)
			if body == "" {
				return nil, errBlankMessage
			}
			if body != m.Body {
				if err := d.Queries.EditChatMessage(ctx, store.EditChatMessageParams{Body: body, ID: m.ID}); err != nil {
					return nil, err
				}
				if err := announceMembers(ctx, d.Queries, ch.ID); err != nil {
					return nil, err
				}
			}
			return &contract.ChatMessageOutput{Body: contract.ChatMessage{ID: m.ID.String(), Body: body, At: nano(m.CreatedAt), EditedAt: time.Now().UTC().Format(time.RFC3339Nano)}}, nil
		})

	react := func(add bool) func(context.Context, *contract.ChatReactionInput) (*struct{}, error) {
		return func(ctx context.Context, in *contract.ChatReactionInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			ch, err := chatChannel(ctx, d.Queries, caller, in.ID)
			if err != nil {
				return nil, err
			}
			m, err := chatMessageIn(ctx, d.Queries, ch.ID, in.Msg)
			if err != nil {
				return nil, err
			}
			if m.DeletedAt.Valid {
				return nil, errMessageNotFound
			}
			p := store.AddChatReactionParams{MessageID: m.ID, UserID: caller.UserID, Emoji: in.Emoji}
			if add {
				err = d.Queries.AddChatReaction(ctx, p)
			} else {
				err = d.Queries.RemoveChatReaction(ctx, store.RemoveChatReactionParams(p))
			}
			if err != nil {
				return nil, err
			}
			if err := d.Queries.TouchChatMessage(ctx, m.ID); err != nil {
				return nil, err
			}
			// Shows live; never pushes, never unread.
			return nil, announceMembers(ctx, d.Queries, ch.ID)
		}
	}
	route(api, huma.Operation{
		OperationID: "addChatReaction", Method: http.MethodPut, Path: "/tenants/{tenant}/chat/channels/{id}/messages/{message}/reactions/{emoji}",
		Summary: "React to a message with one of the six; twice is once", Tags: []string{"chat"}, DefaultStatus: http.StatusNoContent,
	}, chatAccess.Repeatable(), react(true))
	route(api, huma.Operation{
		OperationID: "removeChatReaction", Method: http.MethodDelete, Path: "/tenants/{tenant}/chat/channels/{id}/messages/{message}/reactions/{emoji}",
		Summary: "Take one's reaction back", Tags: []string{"chat"}, DefaultStatus: http.StatusNoContent,
	}, chatAccess.Repeatable(), react(false))

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
			if readOnly(ch.Kind, ch.StoreStatus, ch.Archived) {
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

// chatChannel is one channel, only if the caller is in it or a chat admin (not someone's Notifications).
func chatChannel(ctx context.Context, q *store.Queries, caller auth.Caller, id string) (store.GetChatChannelRow, error) {
	cid, err := uuid(id, errChannelNotFound)
	if err != nil {
		return store.GetChatChannelRow{}, err
	}
	ch, err := q.GetChatChannel(ctx, store.GetChatChannelParams{
		ID: cid, TenantID: caller.TenantID, ChatVip: caller.ChatLevel.AtLeast(auth.VIP), UserID: caller.UserID,
		ChatAdmin: caller.ChatLevel == auth.Admin,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return ch, errChannelNotFound
	}
	return ch, err
}

// chatMessageIn is one message, only if it belongs to the channel.
func chatMessageIn(ctx context.Context, q *store.Queries, channel pgtype.UUID, id string) (store.GetChatMessageRow, error) {
	mid, err := uuid(id, errMessageNotFound)
	if err != nil {
		return store.GetChatMessageRow{}, err
	}
	m, err := q.GetChatMessage(ctx, store.GetChatMessageParams{ID: mid, ChannelID: channel})
	if errors.Is(err, pgx.ErrNoRows) {
		return m, errMessageNotFound
	}
	return m, err
}

// readOnly: the system's inbox, a store no longer open, or an archived group; its history stays readable.
func readOnly(kind, storeStatus string, archived bool) bool {
	return kind == "personal" || (kind == "store" && storeStatus == "inactive") || archived
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

// announceMembers tells everyone in a channel it changed.
func announceMembers(ctx context.Context, q *store.Queries, channel pgtype.UUID) error {
	members, err := q.ListChatMembers(ctx, channel)
	if err != nil {
		return err
	}
	ids := make([]pgtype.UUID, len(members))
	for i, x := range members {
		ids[i] = x.ID
	}
	return announceChat(ctx, q, chatChanged, channel, ids)
}

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
	m.Link = linkOf(r.Metadata)
	if r.ClientKey.Valid {
		m.ClientKey = r.ClientKey.String
	}
	if r.ReplyID.Valid {
		m.ReplyTo = &contract.ChatQuote{ID: r.ReplyID.String(), Author: r.ReplyAuthor, Body: r.ReplyBody, Photo: r.ReplyPhoto, Deleted: r.ReplyDeleted}
		if r.ReplyDeleted {
			m.ReplyTo.Body, m.ReplyTo.Photo = "", false
		}
	}
	if r.DeletedAt.Valid {
		m.Deleted, m.Body, m.ReplyTo, m.Link = true, "", nil, nil
	}
	return m
}

// attachExtras puts each message's photos and reactions on it.
func attachExtras(ctx context.Context, d Deps, items []contract.ChatMessage, me pgtype.UUID) error {
	if err := attachPhotos(ctx, d, items); err != nil {
		return err
	}
	ids := make([]pgtype.UUID, 0, len(items))
	at := map[string]int{}
	for i, m := range items {
		var id pgtype.UUID
		if !m.Deleted && id.Scan(m.ID) == nil {
			ids = append(ids, id)
			at[m.ID] = i
		}
	}
	if len(ids) == 0 {
		return nil
	}
	rows, err := d.Queries.ListChatReactions(ctx, ids)
	if err != nil {
		return err
	}
	for _, r := range rows {
		m := &items[at[r.MessageID.String()]]
		k := slices.IndexFunc(m.Reactions, func(x contract.ChatReaction) bool { return x.Emoji == r.Emoji })
		if k < 0 {
			m.Reactions = append(m.Reactions, contract.ChatReaction{Emoji: r.Emoji, Names: []string{}})
			k = len(m.Reactions) - 1
		}
		m.Reactions[k].Names = append(m.Reactions[k].Names, r.Name)
		if r.UserID == me {
			m.Reactions[k].Mine = true
		}
	}
	return nil
}

// attachPhotos puts each message's photos on it, every address signed in one batch.
func attachPhotos(ctx context.Context, d Deps, items []contract.ChatMessage) error {
	ids := make([]pgtype.UUID, 0, len(items))
	for _, m := range items {
		var id pgtype.UUID
		if !m.Deleted && id.Scan(m.ID) == nil {
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
		// A phone that gave up (context canceled) never sees them: not worth a warning.
		if err != nil && !errors.Is(err, files.ErrNotConfigured) && !errors.Is(err, context.Canceled) {
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
