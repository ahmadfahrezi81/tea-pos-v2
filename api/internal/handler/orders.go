package handler

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/page"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

func registerOrders(api huma.API, d Deps) {
	route(api, huma.Operation{
		OperationID: "listDayOrders",
		Method:      http.MethodGet,
		Path:        "/tenants/{tenant}/orders",
		Summary:     "The orders of a range of days over one store or several, newest first, a page at a time",
		Tags:        []string{"store"},
	}, storeAccess, func(ctx context.Context, in *contract.DayOrdersInput) (*contract.DayOrdersOutput, error) {
		caller, _ := auth.CallerFrom(ctx)
		start, end, err := rangeBounds(in.From, in.To)
		if err != nil {
			return nil, err
		}
		ids, err := storeScope(ctx, d.Queries, caller.TenantID, in.StoreIDs)
		if err != nil {
			return nil, err
		}
		cursor, err := page.Decode(in.Cursor)
		if err != nil {
			return nil, errBadCursor
		}
		rows, err := d.Queries.ListDayOrders(ctx, store.ListDayOrdersParams{
			TenantID: caller.TenantID, StoreIds: ids, DayStart: start, DayEnd: end,
			CursorAt: pgtype.Timestamp{Time: cursor.At, Valid: true}, CursorID: cursor.ID,
			RowLimit: int32(in.Limit + 1),
		})
		if err != nil {
			return nil, err
		}
		out := &contract.DayOrdersOutput{Body: page.Map(page.Rows(rows, in.Limit, func(r store.ListDayOrdersRow) page.Cursor {
			return page.Cursor{At: r.CreatedAt.Time, ID: r.ID}
		}), order)}
		orderIDs := make([]pgtype.UUID, len(out.Body.Items))
		for i, r := range rows[:len(out.Body.Items)] {
			orderIDs[i] = r.ID
		}
		items, err := d.Queries.ListOrderItems(ctx, orderIDs)
		if err != nil {
			return nil, err
		}
		byOrder := map[string][]contract.OrderItem{}
		for _, it := range items {
			id := it.OrderID.String()
			byOrder[id] = append(byOrder[id], contract.OrderItem{
				ID: it.ID.String(), Name: it.Name, Quantity: int64(it.Quantity),
				UnitPrice: int64(it.UnitPrice), TotalPrice: int64(it.TotalPrice),
			})
		}
		for i := range out.Body.Items {
			out.Body.Items[i].Items = append([]contract.OrderItem{}, byOrder[out.Body.Items[i].ID]...)
		}
		return out, nil
	})

	route(api, huma.Operation{
		OperationID: "salesHours",
		Method:      http.MethodGet,
		Path:        "/tenants/{tenant}/sales/hours",
		Summary:     "A day's cups and orders per hour, and its totals, over one store or several",
		Tags:        []string{"store"},
	}, storeAccess, func(ctx context.Context, in *contract.SalesHoursInput) (*contract.SalesHoursOutput, error) {
		caller, _ := auth.CallerFrom(ctx)
		start, end, err := dayBounds(in.Date)
		if err != nil {
			return nil, err
		}
		ids, err := storeScope(ctx, d.Queries, caller.TenantID, in.StoreIDs)
		if err != nil {
			return nil, err
		}
		var (
			wg    sync.WaitGroup
			hours []store.SalesHoursRow
			total store.SalesDayTotalRow
			errs  [2]error
		)
		wg.Go(func() {
			hours, errs[0] = d.Queries.SalesHours(ctx, store.SalesHoursParams{TenantID: caller.TenantID, StoreIds: ids, DayStart: start, DayEnd: end})
		})
		wg.Go(func() {
			total, errs[1] = d.Queries.SalesDayTotal(ctx, store.SalesDayTotalParams{TenantID: caller.TenantID, StoreIds: ids, DayStart: start, DayEnd: end})
		})
		wg.Wait()
		if err := errors.Join(errs[:]...); err != nil {
			return nil, err
		}
		out := &contract.SalesHoursOutput{}
		out.Body.Orders, out.Body.Sales = total.Orders, total.Sales
		out.Body.Hours = []contract.SalesHour{}
		if len(hours) == 0 {
			return out, nil
		}
		byHour := map[int]store.SalesHoursRow{}
		for _, h := range hours {
			byHour[int(h.Hour)] = h
			out.Body.Cups += h.Cups
		}
		// Every hour from the one before the first sale to the one after the last, as the old app.
		first, last := max(0, int(hours[0].Hour)-1), min(23, int(hours[len(hours)-1].Hour)+1)
		for h := first; h <= last; h++ {
			out.Body.Hours = append(out.Body.Hours, contract.SalesHour{Hour: h, Orders: byHour[h].Orders, Cups: byHour[h].Cups})
		}
		return out, nil
	})
}

func order(r store.ListDayOrdersRow) contract.Order {
	return contract.Order{
		ID: r.ID.String(), At: utc(r.CreatedAt), Total: int64(r.TotalAmount), PaymentMethod: r.PaymentMethod,
		StoreName: r.StoreName, Seller: r.Seller.String, Cups: r.Cups,
	}
}

// rangeBounds is from's start to the end of to, each a store's day.
func rangeBounds(from, to string) (start, end pgtype.Timestamp, err error) {
	if _, _, err = dateRange(from, to); err != nil {
		return start, end, err
	}
	start, _, err = dayBounds(from)
	if err != nil {
		return start, end, err
	}
	_, end, err = dayBounds(to)
	return start, end, err
}

// dayBounds is a store's day (WIB) as the old tables hold time: UTC without a zone.
func dayBounds(date string) (start, end pgtype.Timestamp, err error) {
	d, err := time.ParseInLocation(time.DateOnly, date, domain.WIB)
	if err != nil {
		return start, end, errBadRange
	}
	return pgtype.Timestamp{Time: d.UTC(), Valid: true}, pgtype.Timestamp{Time: d.AddDate(0, 0, 1).UTC(), Valid: true}, nil
}
