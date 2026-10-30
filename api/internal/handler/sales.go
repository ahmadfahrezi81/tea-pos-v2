package handler

import (
	"context"
	"net/http"
	"slices"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

// storeAccess is the Store tab's: anyone with a backoffice level in the tenant, guests included.
var storeAccess = auth.App("backoffice", auth.Guest)

// maxDays bounds a range: a year and a bit, for the monthly chart.
const maxDays = 400

func registerSales(api huma.API, d Deps) {
	route(api, huma.Operation{
		OperationID: "storesLive",
		Method:      http.MethodGet,
		Path:        "/tenants/{tenant}/stores/live",
		Summary:     "Every store: open or closed right now and who is selling, with the sales of a range (today by default)",
		Tags:        []string{"store"},
	}, storeAccess, func(ctx context.Context, in *contract.StoresLiveInput) (*contract.StoresLiveOutput, error) {
		caller, _ := auth.CallerFrom(ctx)
		today := time.Now().In(domain.WIB).Format(time.DateOnly)
		from, to := in.From, in.To
		if from == "" {
			from = today
		}
		if to == "" {
			to = from
		}
		start, end, err := rangeBounds(from, to)
		if err != nil {
			return nil, err
		}
		rows, err := d.Queries.StoresLive(ctx, store.StoresLiveParams{TenantID: caller.TenantID, DayStart: start, DayEnd: end})
		if err != nil {
			return nil, err
		}
		sold, err := d.Queries.StoresLiveSellers(ctx, store.StoresLiveSellersParams{TenantID: caller.TenantID, DayStart: start, DayEnd: end})
		if err != nil {
			return nil, err
		}
		sellers := map[string][]contract.DaySeller{}
		for _, r := range sold {
			id := r.StoreID.String()
			sellers[id] = append(sellers[id], contract.DaySeller{UserID: r.UserID.String(), Name: r.Name, AvatarURL: r.AvatarUrl, Cups: r.Cups})
		}
		out := &contract.StoresLiveOutput{}
		out.Body.Date = today
		out.Body.Stores = make([]contract.StoreLive, len(rows))
		for i, r := range rows {
			s := contract.StoreLive{
				ID: r.ID.String(), Name: r.Name, Status: r.Status, Open: r.OpenSince.Valid,
				Orders: r.Orders, Cups: r.Cups, Sales: r.Sales,
				Sellers: sellers[r.ID.String()],
			}
			if s.Sellers == nil {
				s.Sellers = []contract.DaySeller{}
			}
			if s.Open {
				s.OpenSince, s.SellerName, s.SellerAvatar = &r.OpenSince.Time, r.SellerName, r.SellerAvatar
				// The seller on shift shows before their first order too.
				if r.SellerID.Valid && !slices.ContainsFunc(s.Sellers, func(x contract.DaySeller) bool { return x.UserID == r.SellerID.String() }) {
					s.Sellers = append(s.Sellers, contract.DaySeller{UserID: r.SellerID.String(), Name: r.SellerName, AvatarURL: r.SellerAvatar})
				}
			} else if r.LastClosed.Valid {
				// The old tables hold UTC without a zone.
				at := r.LastClosed.Time.UTC()
				s.LastClosed = &at
			}
			out.Body.Stores[i] = s
		}
		return out, nil
	})

	route(api, huma.Operation{
		OperationID: "salesDays",
		Method:      http.MethodGet,
		Path:        "/tenants/{tenant}/sales/days",
		Summary:     "Sales, orders and cups per day, over one store or several",
		Tags:        []string{"store"},
	}, storeAccess, func(ctx context.Context, in *contract.SalesDaysInput) (*contract.SalesDaysOutput, error) {
		tenant, ids, from, to, err := rangeScope(ctx, d.Queries, in)
		if err != nil {
			return nil, err
		}
		rows, err := d.Queries.SalesDays(ctx, store.SalesDaysParams{TenantID: tenant, StoreIds: ids, FromDate: from, ToDate: to})
		if err != nil {
			return nil, err
		}
		out := &contract.SalesDaysOutput{}
		out.Body.Days = make([]contract.SalesDay, len(rows))
		for i, r := range rows {
			out.Body.Days[i] = contract.SalesDay{
				Date: r.Date.Time.Format(time.DateOnly), Sales: r.Sales, Orders: r.Orders, Cups: r.Cups,
				Stores: int(r.Stores), NotClosed: int(r.NotClosed),
			}
		}
		return out, nil
	})

	route(api, huma.Operation{
		OperationID: "salesProducts",
		Method:      http.MethodGet,
		Path:        "/tenants/{tenant}/sales/products",
		Summary:     "Cups per product over one store or several",
		Tags:        []string{"store"},
	}, storeAccess, func(ctx context.Context, in *contract.RangeInput) (*contract.SalesProductsOutput, error) {
		tenant, ids, _, _, err := rangeScope(ctx, d.Queries, in)
		if err != nil {
			return nil, err
		}
		start, _, _ := dayBounds(in.From)
		_, end, _ := dayBounds(in.To)
		rows, err := d.Queries.SalesProducts(ctx, store.SalesProductsParams{TenantID: tenant, StoreIds: ids, StartAt: start, EndAt: end})
		if err != nil {
			return nil, err
		}
		out := &contract.SalesProductsOutput{}
		out.Body.Products = make([]contract.SalesProduct, len(rows))
		for i, r := range rows {
			out.Body.Products[i] = contract.SalesProduct{ID: r.ID.String(), Name: r.Name, Quantity: r.Quantity}
		}
		return out, nil
	})

	route(api, huma.Operation{
		OperationID: "teaWaste",
		Method:      http.MethodGet,
		Path:        "/tenants/{tenant}/tea-waste",
		Summary:     "Litres of tea left at closing per day, over one store or several",
		Tags:        []string{"store"},
	}, storeAccess, func(ctx context.Context, in *contract.RangeInput) (*contract.TeaWasteOutput, error) {
		tenant, ids, from, to, err := rangeScope(ctx, d.Queries, in)
		if err != nil {
			return nil, err
		}
		rows, err := d.Queries.TeaWaste(ctx, store.TeaWasteParams{TenantID: tenant, StoreIds: ids, FromDate: from, ToDate: to})
		if err != nil {
			return nil, err
		}
		out := &contract.TeaWasteOutput{}
		out.Body.Days = make([]contract.TeaWasteDay, len(rows))
		for i, r := range rows {
			out.Body.Days[i] = contract.TeaWasteDay{Date: r.Date.Time.Format(time.DateOnly), Litres: r.Litres}
		}
		return out, nil
	})
}

// rangeScope reads a Store screen's days and stores.
func rangeScope(ctx context.Context, q *store.Queries, in *contract.RangeInput) (pgtype.UUID, []pgtype.UUID, pgtype.Date, pgtype.Date, error) {
	caller, _ := auth.CallerFrom(ctx)
	from, to, err := dateRange(in.From, in.To)
	if err != nil {
		return caller.TenantID, nil, from, to, err
	}
	ids, err := storeScope(ctx, q, caller.TenantID, in.StoreIDs)
	return caller.TenantID, ids, from, to, err
}

// storeScope is the stores a Store screen adds up: the ones named, each the tenant's, or all.
func storeScope(ctx context.Context, q *store.Queries, tenantID pgtype.UUID, named []string) ([]pgtype.UUID, error) {
	if len(named) == 0 {
		return q.TenantStoreIDs(ctx, tenantID)
	}
	ids := make([]pgtype.UUID, len(named))
	for i, s := range named {
		if err := ids[i].Scan(s); err != nil {
			return nil, errNotAStore
		}
	}
	n, err := q.CountTenantStores(ctx, store.CountTenantStoresParams{TenantID: tenantID, Ids: ids})
	if err != nil {
		return nil, err
	}
	if int(n) != len(uniq(named)) {
		return nil, errStoreNotFound
	}
	return ids, nil
}

func dateRange(fromS, toS string) (from, to pgtype.Date, err error) {
	f, err1 := time.Parse(time.DateOnly, fromS)
	t, err2 := time.Parse(time.DateOnly, toS)
	if err1 != nil || err2 != nil || t.Before(f) || t.Sub(f) > maxDays*24*time.Hour {
		return from, to, errBadRange
	}
	return pgtype.Date{Time: f, Valid: true}, pgtype.Date{Time: t, Valid: true}, nil
}

func uniq(s []string) map[string]bool {
	m := make(map[string]bool, len(s))
	for _, v := range s {
		m[v] = true
	}
	return m
}
