package handler

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

// registerPush is a phone's Web Push subscription: asked again on every start, so a cleared
// site heals by itself; the row is the real off switch. Push is not only chat's.
func registerPush(api huma.API, d Deps) {
	op := func(id, method, path, summary string) huma.Operation {
		return huma.Operation{OperationID: id, Method: method, Path: "/push" + path, Summary: summary, Tags: []string{"push"}, DefaultStatus: http.StatusNoContent}
	}
	key := op("getPushKey", http.MethodGet, "/key", "The public key phones subscribe with")
	key.DefaultStatus = http.StatusOK
	route(api, key, auth.SignedIn,
		func(_ context.Context, _ *struct{}) (*contract.PushKeyOutput, error) {
			out := &contract.PushKeyOutput{}
			out.Body.Key = d.VapidPublicKey
			return out, nil
		})

	route(api, op("putPushSubscription", http.MethodPut, "/subscription", "This phone's subscription, kept per endpoint"), auth.SignedIn.Repeatable(),
		func(ctx context.Context, in *contract.PushSubscriptionInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			ua := in.UserAgent
			if len(ua) > 300 {
				ua = ua[:300]
			}
			return nil, d.Queries.UpsertPushSubscription(ctx, store.UpsertPushSubscriptionParams{
				UserID: caller.UserID, Endpoint: in.Body.Endpoint, P256dh: in.Body.P256dh, Auth: in.Body.Auth, UserAgent: ua,
			})
		})

	route(api, op("pushOff", http.MethodPost, "/subscription/off", "This phone wants no more pushes"), auth.SignedIn.Repeatable(),
		func(ctx context.Context, in *contract.PushOffInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			return nil, d.Queries.DeletePushSubscription(ctx, store.DeletePushSubscriptionParams{Endpoint: in.Body.Endpoint, UserID: caller.UserID})
		})
}
