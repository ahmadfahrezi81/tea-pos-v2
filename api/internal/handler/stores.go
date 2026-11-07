package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/idem"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/realtime"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

var (
	errBadHours        = httpx.New(http.StatusUnprocessableEntity, "bad_hours", "A store opens before it closes")
	errStoreHasHistory = httpx.New(http.StatusConflict, "store_has_history", "This store has sales or days: make it Inactive instead")
)

// storesChanged: a store was added, changed or removed; every app reloads /me, which lists them.
const storesChanged = "stores"

func registerStores(api huma.API, d Deps) {
	op := func(id, method, path, summary string) huma.Operation {
		return huma.Operation{OperationID: id, Method: method, Path: "/tenants/{tenant}" + path, Summary: summary, Tags: []string{"store"}}
	}
	read := auth.App("backoffice", auth.Guest)
	write := auth.App("backoffice", auth.Admin)

	route(api, op("listStoreSettings", http.MethodGet, "/store-settings", "Every store with its details, for Store settings"), read,
		func(ctx context.Context, _ *contract.TenantInput) (*contract.StoreSettingsListOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			rows, err := d.Queries.ListStoreSettings(ctx, caller.TenantID)
			if err != nil {
				return nil, err
			}
			out := &contract.StoreSettingsListOutput{}
			out.Body.Stores = make([]contract.StoreSettings, len(rows))
			for i, r := range rows {
				out.Body.Stores[i] = storeSettings(store.GetStoreSettingsRow(r))
			}
			return out, nil
		})

	route(api, op("getStoreSettings", http.MethodGet, "/store-settings/{storeId}", "One store's details"), read,
		func(ctx context.Context, in *contract.StoreSettingsInput) (*contract.StoreSettingsOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			s, err := storeOf(ctx, d.Queries, caller.TenantID, in.StoreID)
			if err != nil {
				return nil, err
			}
			return &contract.StoreSettingsOutput{Body: storeSettings(s)}, nil
		})

	route(api, op("createStore", http.MethodPost, "/store-settings", "Add a store; who works there is set in UAC"), write.Idempotent(),
		func(ctx context.Context, in *contract.CreateStoreInput) (*contract.StoreSettingsOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			c, err := checkStore(in.Body)
			if err != nil {
				return nil, err
			}
			q := idem.Queries(ctx, d.Queries)
			id, err := q.CreateStore(ctx, store.CreateStoreParams{
				TenantID: caller.TenantID, Name: c.Name, Address: c.Address,
				Latitude: float(c.Latitude), Longitude: float(c.Longitude),
				Status: c.Status, OpenTime: c.OpenTime, CloseTime: c.CloseTime,
			})
			if err != nil {
				return nil, err
			}
			if err := announceStores(ctx, q, caller); err != nil {
				return nil, err
			}
			s, err := storeOf(ctx, q, caller.TenantID, id.String())
			if err != nil {
				return nil, err
			}
			return &contract.StoreSettingsOutput{Body: storeSettings(s)}, nil
		})

	route(api, op("updateStore", http.MethodPut, "/store-settings/{storeId}", "Change a store's name, address, hours, status and location, at once"), write.Idempotent(),
		func(ctx context.Context, in *contract.UpdateStoreInput) (*contract.StoreSettingsOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			c, err := checkStore(in.Body)
			if err != nil {
				return nil, err
			}
			id, err := uuid(in.StoreID, errStoreNotFound)
			if err != nil {
				return nil, err
			}
			q := idem.Queries(ctx, d.Queries)
			n, err := q.UpdateStore(ctx, store.UpdateStoreParams{
				ID: id, TenantID: caller.TenantID, Name: c.Name, Address: c.Address,
				Latitude: float(c.Latitude), Longitude: float(c.Longitude),
				Status: c.Status, OpenTime: c.OpenTime, CloseTime: c.CloseTime,
			})
			if err != nil {
				return nil, err
			}
			if n == 0 {
				return nil, errStoreNotFound
			}
			if err := announceStores(ctx, q, caller); err != nil {
				return nil, err
			}
			s, err := storeOf(ctx, q, caller.TenantID, in.StoreID)
			if err != nil {
				return nil, err
			}
			return &contract.StoreSettingsOutput{Body: storeSettings(s)}, nil
		})

	del := op("deleteStore", http.MethodDelete, "/store-settings/{storeId}", "Remove a store that has nothing recorded yet (a mistake); one with history is made Inactive instead")
	del.DefaultStatus = http.StatusNoContent
	route(api, del, write.Repeatable(),
		func(ctx context.Context, in *contract.StoreSettingsInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			id, err := uuid(in.StoreID, errStoreNotFound)
			if err != nil {
				return nil, err
			}
			n, err := d.Queries.DeleteStore(ctx, store.DeleteStoreParams{ID: id, TenantID: caller.TenantID})
			var pg *pgconn.PgError
			if errors.As(err, &pg) && pg.Code == "23503" {
				return nil, errStoreHasHistory
			}
			if err != nil {
				return nil, err
			}
			if n == 0 {
				return nil, errStoreNotFound
			}
			return nil, announceStores(ctx, d.Queries, caller)
		})
}

// checkStore trims and checks what the contract cannot: a name, and opening before closing.
func checkStore(c contract.StoreChange) (contract.StoreChange, error) {
	c.Name, c.Address = strings.TrimSpace(c.Name), strings.TrimSpace(c.Address)
	if c.Name == "" {
		return c, errBlankName
	}
	if c.OpenTime >= c.CloseTime {
		return c, errBadHours
	}
	return c, nil
}

func storeOf(ctx context.Context, q *store.Queries, tenant pgtype.UUID, storeID string) (store.GetStoreSettingsRow, error) {
	id, err := uuid(storeID, errStoreNotFound)
	if err != nil {
		return store.GetStoreSettingsRow{}, err
	}
	s, err := q.GetStoreSettings(ctx, store.GetStoreSettingsParams{ID: id, TenantID: tenant})
	if errors.Is(err, pgx.ErrNoRows) {
		return s, errStoreNotFound
	}
	return s, err
}

func storeSettings(s store.GetStoreSettingsRow) contract.StoreSettings {
	out := contract.StoreSettings{
		ID: s.ID.String(), Name: s.Name, Address: s.Address,
		Status: s.Status, OpenTime: s.OpenTime, CloseTime: s.CloseTime,
	}
	if s.Latitude.Valid {
		out.Latitude = &s.Latitude.Float64
	}
	if s.Longitude.Valid {
		out.Longitude = &s.Longitude.Float64
	}
	return out
}

func float(f *float64) pgtype.Float8 {
	if f == nil {
		return pgtype.Float8{}
	}
	return pgtype.Float8{Float64: *f, Valid: true}
}

func announceStores(ctx context.Context, q *store.Queries, caller auth.Caller) error {
	return realtime.Announce(ctx, q, realtime.Event{Topic: realtime.TenantTopic(caller.TenantID.String()), Kind: storesChanged})
}
