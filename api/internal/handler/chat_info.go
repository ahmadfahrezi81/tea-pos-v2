package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/files"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

// errOwnerOnly: Clear chat is the owner's alone (task 078).
var errOwnerOnly = httpx.New(http.StatusForbidden, "owner_only", "Only the owner can do this")

// A chat's info page (task 078): its photos and what was shared there, and Clear chat.
func registerChatInfo(api huma.API, d Deps) {
	route(api, huma.Operation{
		OperationID: "listChatMedia", Method: http.MethodGet, Path: "/tenants/{tenant}/chat/channels/{id}/media",
		Summary: "A chat's photos and shared screens, newest first, for its info", Tags: []string{"chat"},
	}, chatAccess, func(ctx context.Context, in *contract.ChatChannelInput) (*contract.ChatMediaOutput, error) {
		caller, _ := auth.CallerFrom(ctx)
		ch, err := chatChannel(ctx, d.Queries, caller, in.ID)
		if err != nil {
			return nil, err
		}
		out := &contract.ChatMediaOutput{}
		out.Body.Photos, out.Body.Shared = []contract.ChatPhoto{}, []contract.ChatMessage{}
		photos, err := d.Queries.ListChannelPhotos(ctx, store.ListChannelPhotosParams{ChannelID: ch.ID, Lim: 60})
		if err != nil {
			return nil, err
		}
		if len(photos) > 0 {
			out.Body.Photos = signedPhotos(ctx, d.Files, photos)
		}
		shared, err := d.Queries.ListChannelShared(ctx, store.ListChannelSharedParams{ChannelID: ch.ID, Lim: 50})
		if err != nil {
			return nil, err
		}
		for _, r := range shared {
			out.Body.Shared = append(out.Body.Shared, contract.ChatMessage{
				ID: r.ID.String(), Author: r.AuthorName, At: nano(r.CreatedAt), Link: linkOf(r.Metadata),
			})
		}
		return out, resolveLinks(ctx, d.Queries, caller, out.Body.Shared)
	})

	route(api, huma.Operation{
		OperationID: "clearChat", Method: http.MethodPost, Path: "/tenants/{tenant}/chat/channels/{id}/clear",
		Summary: "Empty a chat for everyone (the owner only); nothing is deleted, only hidden", Tags: []string{"chat"},
		DefaultStatus: http.StatusNoContent,
	}, chatAccess.Repeatable(), func(ctx context.Context, in *contract.ChatChannelInput) (*struct{}, error) {
		caller, _ := auth.CallerFrom(ctx)
		if !caller.Owner {
			return nil, errOwnerOnly
		}
		ch, err := chatChannel(ctx, d.Queries, caller, in.ID)
		if err != nil {
			return nil, err
		}
		if ch.Kind == "personal" {
			return nil, errChannelNotFound
		}
		if err := d.Queries.ClearChatChannel(ctx, ch.ID); err != nil {
			return nil, err
		}
		return nil, announceMembers(ctx, d.Queries, ch.ID)
	})
}

// signedPhotos signs a list of photos in one call, as a message's are.
func signedPhotos(ctx context.Context, s *files.Storage, photos []store.ChatMessagePhoto) []contract.ChatPhoto {
	paths := make([]string, 0, 2*len(photos))
	for _, p := range photos {
		paths = append(paths, p.Path, p.PreviewPath)
	}
	signed := map[string]string{}
	if s != nil {
		var err error
		signed, err = s.SignReads(ctx, files.Purposes["chat_photo"].Bucket, paths, chatPhotoTTL)
		if err != nil && !errors.Is(err, files.ErrNotConfigured) && !errors.Is(err, context.Canceled) {
			slog.WarnContext(ctx, "sign chat photos", "err", err)
		}
	}
	out := make([]contract.ChatPhoto, len(photos))
	for i, p := range photos {
		out[i] = contract.ChatPhoto{URL: signed[p.Path], PreviewURL: signed[p.PreviewPath], Width: int(p.Width), Height: int(p.Height)}
	}
	return out
}
