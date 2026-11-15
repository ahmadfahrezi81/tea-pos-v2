package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

// A channel the caller is not in answers as one that does not exist: nothing about it leaks.
var errChannelNotFound = httpx.New(http.StatusNotFound, "channel_not_found", "That chat was not found")

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
