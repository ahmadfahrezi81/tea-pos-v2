package handler

import (
	"context"
	"net/http"
	"sync"

	"github.com/danielgtaylor/huma/v2"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

func registerMe(api huma.API, d Deps) {
	route(api, huma.Operation{
		OperationID: "getMe",
		Method:      http.MethodGet,
		Path:        "/me",
		Summary:     "The signed-in user, their tenants and stores",
		Tags:        []string{"me"},
	}, auth.SignedIn, func(ctx context.Context, _ *struct{}) (*contract.MeOutput, error) {
		caller, _ := auth.CallerFrom(ctx)

		// Three small reads, side by side: one round trip of waiting instead of three.
		var (
			wg      sync.WaitGroup
			me      store.GetMeRow
			tenants []store.ListUserTenantsRow
			stores  []store.ListAssignedStoresRow
			errs    [3]error
		)
		wg.Go(func() { me, errs[0] = d.Queries.GetMe(ctx, caller.UserID) })
		wg.Go(func() { tenants, errs[1] = d.Queries.ListUserTenants(ctx, caller.UserID) })
		wg.Go(func() { stores, errs[2] = listStores(ctx, d.Queries, caller) })
		wg.Wait()
		for _, err := range errs {
			if err != nil {
				return nil, err
			}
		}

		out := &contract.MeOutput{Body: contract.Me{
			User: contract.MeUser{
				ID:        me.ID.String(),
				Email:     me.Email,
				FullName:  me.FullName,
				Role:      me.Role,
				AvatarURL: me.AvatarUrl.String,
				Language:  me.PreferredLanguage,
			},
			Tenants: make([]contract.MeTenant, 0, len(tenants)),
		}}
		byTenant := map[string][]contract.MeStore{}
		for _, s := range stores {
			id := s.TenantID.String()
			byTenant[id] = append(byTenant[id], contract.MeStore{
				ID:        s.ID.String(),
				Name:      s.Name,
				Status:    s.Status,
				OpenTime:  s.OpenTime,
				CloseTime: s.CloseTime,
				IsDefault: s.IsDefault,
			})
		}
		for _, t := range tenants {
			id := t.ID.String()
			out.Body.Tenants = append(out.Body.Tenants, contract.MeTenant{
				ID:           id,
				Slug:         t.Slug,
				Name:         t.Name,
				PayFrequency: t.PayFrequency,
				Stores:       append([]contract.MeStore{}, byTenant[id]...),
			})
		}
		return out, nil
	})
}

// listStores is the stores the app shows: seller its roster, backoffice the whole tenant.
func listStores(ctx context.Context, q *store.Queries, caller auth.Caller) ([]store.ListAssignedStoresRow, error) {
	if caller.App == "seller" {
		return q.ListAssignedStores(ctx, caller.UserID)
	}
	rows, err := q.ListTenantStores(ctx, caller.UserID)
	out := make([]store.ListAssignedStoresRow, len(rows))
	for i, r := range rows {
		out[i] = store.ListAssignedStoresRow(r)
	}
	return out, err
}
