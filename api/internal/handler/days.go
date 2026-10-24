package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/files"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

// photoTTL is how long a day's photo address works: enough to look through the day.
const photoTTL = 10 * time.Minute

// dayEvents are the activity a day's timeline shows, as the old app's.
var dayEvents = []string{
	"order_created", "store_opened", "store_closed", "opening_balance_updated",
	"summary_photo_uploaded", "summary_photo_deleted", "summary_photo_updated",
	"expense_created", "expense_updated", "expense_deleted",
	"session_transferred", "session_ended", "supply_request_created", "incident_report_created",
}

func registerDays(api huma.API, d Deps) {
	route(api, huma.Operation{
		OperationID: "listDays",
		Method:      http.MethodGet,
		Path:        "/tenants/{tenant}/days",
		Summary:     "A month of the stores' days, with expenses and who worked",
		Tags:        []string{"store"},
	}, storeAccess, func(ctx context.Context, in *contract.DaysInput) (*contract.DaysOutput, error) {
		caller, _ := auth.CallerFrom(ctx)
		first, err := time.Parse("2006-01", in.Month)
		if err != nil {
			return nil, errBadRange
		}
		ids, err := storeScope(ctx, d.Queries, caller.TenantID, in.StoreIDs)
		if err != nil {
			return nil, err
		}
		rows, err := d.Queries.ListDays(ctx, store.ListDaysParams{
			TenantID: caller.TenantID, StoreIds: ids,
			FromDate: pgtype.Date{Time: first, Valid: true},
			ToDate:   pgtype.Date{Time: first.AddDate(0, 1, -1), Valid: true},
		})
		if err != nil {
			return nil, err
		}
		dayIDs := make([]pgtype.UUID, len(rows))
		for i, r := range rows {
			dayIDs[i] = r.ID
		}
		// Expenses and sellers for the whole month, side by side: two queries, not two per day.
		var (
			wg       sync.WaitGroup
			expenses []store.ListDayExpensesRow
			sellers  []store.ListDaySellersRow
			errs     [2]error
		)
		wg.Go(func() { expenses, errs[0] = d.Queries.ListDayExpenses(ctx, dayIDs) })
		wg.Go(func() { sellers, errs[1] = d.Queries.ListDaySellers(ctx, dayIDs) })
		wg.Wait()
		if err := errors.Join(errs[:]...); err != nil {
			return nil, err
		}
		expensesOf := map[pgtype.UUID][]contract.DayExpense{}
		for _, e := range expenses {
			expensesOf[e.DailySummaryID] = append(expensesOf[e.DailySummaryID], dayExpense(e))
		}
		sellersOf := map[pgtype.UUID][]contract.DaySeller{}
		for _, s := range sellers {
			sellersOf[s.DailySummaryID] = append(sellersOf[s.DailySummaryID], contract.DaySeller{
				UserID: s.UserID.String(), Name: s.FullName, AvatarURL: s.AvatarUrl.String, Cups: s.Cups,
			})
		}
		out := &contract.DaysOutput{}
		out.Body.Days = make([]contract.Day, len(rows))
		for i, r := range rows {
			out.Body.Days[i] = day(r)
			out.Body.Days[i].ExpenseItems = append([]contract.DayExpense{}, expensesOf[r.ID]...)
			out.Body.Days[i].Sellers = append([]contract.DaySeller{}, sellersOf[r.ID]...)
		}
		return out, nil
	})

	route(api, huma.Operation{
		OperationID: "getDay",
		Method:      http.MethodGet,
		Path:        "/tenants/{tenant}/days/{id}",
		Summary:     "One store's day: cash, expenses, who worked, photos, products",
		Tags:        []string{"store"},
	}, storeAccess, func(ctx context.Context, in *contract.DayInput) (*contract.DayOutput, error) {
		caller, _ := auth.CallerFrom(ctx)
		id, err := dayID(in.ID)
		if err != nil {
			return nil, err
		}
		r, err := d.Queries.GetDay(ctx, store.GetDayParams{ID: id, TenantID: caller.TenantID})
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errDayNotFound
		}
		if err != nil {
			return nil, err
		}
		ids := []pgtype.UUID{id}
		var (
			wg       sync.WaitGroup
			expenses []store.ListDayExpensesRow
			sellers  []store.ListDaySellersRow
			photos   []store.ListDayPhotosRow
			products []store.ListDayProductsRow
			errs     [4]error
		)
		wg.Go(func() { expenses, errs[0] = d.Queries.ListDayExpenses(ctx, ids) })
		wg.Go(func() { sellers, errs[1] = d.Queries.ListDaySellers(ctx, ids) })
		wg.Go(func() { photos, errs[2] = d.Queries.ListDayPhotos(ctx, id) })
		wg.Go(func() { products, errs[3] = d.Queries.ListDayProducts(ctx, id) })
		wg.Wait()
		if err := errors.Join(errs[:]...); err != nil {
			return nil, err
		}

		out := &contract.DayOutput{}
		b := &out.Body
		b.Day = day(store.ListDaysRow{
			ID: r.ID, StoreID: r.StoreID, StoreName: r.StoreName, Date: r.Date, OpeningBalance: r.OpeningBalance,
			TotalSales: r.TotalSales, TotalOrders: r.TotalOrders, TotalCups: r.TotalCups, TotalExpenses: r.TotalExpenses,
			ExpectedCash: r.ExpectedCash, ActualCash: r.ActualCash, Variance: r.Variance, Notes: r.Notes, ClosedAt: r.ClosedAt,
		})
		b.OpenedBy, b.ClosedBy, b.OpenedAt = r.OpenedBy.String, r.ClosedBy.String, utc(r.CreatedAt)
		b.ExpenseItems = make([]contract.DayExpense, len(expenses))
		for i, e := range expenses {
			b.ExpenseItems[i] = dayExpense(e)
		}
		b.Sellers = make([]contract.DaySeller, len(sellers))
		for i, s := range sellers {
			b.Sellers[i] = contract.DaySeller{UserID: s.UserID.String(), Name: s.FullName, AvatarURL: s.AvatarUrl.String, Cups: s.Cups}
		}
		b.Products = make([]contract.DayProduct, len(products))
		for i, p := range products {
			b.Products[i] = contract.DayProduct{Name: p.Name, Quantity: p.Quantity, Revenue: p.Revenue}
		}
		urls := make([]string, len(photos))
		for i, p := range photos {
			urls[i] = p.Url
		}
		signed := signPhotos(ctx, d.Files, urls)
		b.Photos = make([]contract.DayPhoto, len(photos))
		for i, p := range photos {
			b.Photos[i] = contract.DayPhoto{Type: p.Type, URL: signed[p.Url]}
			var q contract.DayQuantity
			if json.Unmarshal(p.Quantity, &q) == nil && q.Unit != "" {
				b.Photos[i].Quantity = &q
			}
		}
		return out, nil
	})

	route(api, huma.Operation{
		OperationID: "getDayActivity",
		Method:      http.MethodGet,
		Path:        "/tenants/{tenant}/days/{id}/activity",
		Summary:     "What happened during a store's day, oldest first",
		Tags:        []string{"store"},
	}, storeAccess, func(ctx context.Context, in *contract.DayInput) (*contract.DayActivityOutput, error) {
		caller, id, err := ownDay(ctx, d.Queries, in.ID)
		if err != nil {
			return nil, err
		}
		rows, err := d.Queries.ListDayActivity(ctx, store.ListDayActivityParams{SummaryID: id, TenantID: caller.TenantID, Types: dayEvents})
		if err != nil {
			return nil, err
		}
		metas := make([]map[string]any, len(rows))
		var urls []string
		for i, r := range rows {
			_ = json.Unmarshal(r.Metadata, &metas[i])
			if u, ok := metas[i]["photo_url"].(string); ok {
				urls = append(urls, u)
			}
		}
		signed := signPhotos(ctx, d.Files, urls)
		out := &contract.DayActivityOutput{}
		out.Body.Events = make([]contract.DayEvent, len(rows))
		for i, r := range rows {
			if u, ok := metas[i]["photo_url"].(string); ok {
				metas[i]["photo_url"] = signed[u]
			}
			meta, _ := json.Marshal(metas[i])
			out.Body.Events[i] = contract.DayEvent{
				ID: r.ID.String(), Type: r.Type, At: r.CreatedAt.Time.UTC().Format(time.RFC3339),
				UserName: r.UserName.String, Metadata: meta,
			}
		}
		return out, nil
	})

	route(api, huma.Operation{
		OperationID: "getDaySessions",
		Method:      http.MethodGet,
		Path:        "/tenants/{tenant}/days/{id}/sessions",
		Summary:     "Who held a store's day, and the handovers",
		Tags:        []string{"store"},
	}, storeAccess, func(ctx context.Context, in *contract.DayInput) (*contract.DaySessionsOutput, error) {
		caller, id, err := ownDay(ctx, d.Queries, in.ID)
		if err != nil {
			return nil, err
		}
		rows, err := d.Queries.ListDaySessions(ctx, store.ListDaySessionsParams{SummaryID: id, TenantID: caller.TenantID})
		if err != nil {
			return nil, err
		}
		out := &contract.DaySessionsOutput{}
		out.Body.Sessions = make([]contract.DaySession, len(rows))
		for i, r := range rows {
			s := contract.DaySession{
				ID: r.ID.String(), UserID: r.UserID.String(), UserName: r.FullName.String, AvatarURL: r.AvatarUrl.String,
				StartedAt: r.StartedAt.Time.UTC().Format(time.RFC3339), Status: r.Status,
			}
			if r.EndedAt.Valid {
				s.EndedAt = r.EndedAt.Time.UTC().Format(time.RFC3339)
			}
			if r.PreviousSessionID.Valid {
				s.PreviousSessionID = r.PreviousSessionID.String()
			}
			out.Body.Sessions[i] = s
		}
		return out, nil
	})
}

func day(r store.ListDaysRow) contract.Day {
	return contract.Day{
		ID: r.ID.String(), StoreID: r.StoreID.String(), StoreName: r.StoreName,
		Date: r.Date.Time.Format(time.DateOnly), OpeningBalance: int64(r.OpeningBalance),
		Sales: int64(r.TotalSales), Orders: int64(r.TotalOrders), Cups: int64(r.TotalCups),
		Expenses: r.TotalExpenses, ExpectedCash: int64(r.ExpectedCash),
		ActualCash: int4(r.ActualCash), Variance: int4(r.Variance), Notes: r.Notes.String, ClosedAt: utc(r.ClosedAt),
	}
}

func dayExpense(e store.ListDayExpensesRow) contract.DayExpense {
	return contract.DayExpense{ID: e.ID.String(), Type: e.Type, Amount: int64(e.Amount), Notes: e.Notes.String}
}

func int4(v pgtype.Int4) *int64 {
	if !v.Valid {
		return nil
	}
	n := int64(v.Int32)
	return &n
}

// utc reads the old tables' timestamps without a zone, which hold UTC.
func utc(t pgtype.Timestamp) string {
	if !t.Valid {
		return ""
	}
	return t.Time.UTC().Format(time.RFC3339)
}

func dayID(s string) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := id.Scan(s); err != nil {
		return id, errDayNotFound
	}
	return id, nil
}

// ownDay is the caller and the day, when the day is the caller's tenant's.
func ownDay(ctx context.Context, q *store.Queries, s string) (auth.Caller, pgtype.UUID, error) {
	caller, _ := auth.CallerFrom(ctx)
	id, err := dayID(s)
	if err != nil {
		return caller, id, err
	}
	ok, err := q.DayInTenant(ctx, store.DayInTenantParams{ID: id, TenantID: caller.TenantID})
	if err == nil && !ok {
		err = errDayNotFound
	}
	return caller, id, err
}

// signPhotos gives each saved day-photo address a short-lived signed one; a photo that cannot
// be signed (Storage down, a file another project holds) is left empty, and the day still shows.
func signPhotos(ctx context.Context, s *files.Storage, addresses []string) map[string]string {
	bucket := files.Purposes["daily_photo"].Bucket
	pathOf := map[string]string{}
	var paths []string
	for _, a := range addresses {
		if p := files.PathIn(bucket, a); p != "" {
			pathOf[a] = p
			paths = append(paths, p)
		}
	}
	out := map[string]string{}
	signed, err := s.SignReads(ctx, bucket, paths, photoTTL)
	if err != nil {
		if !errors.Is(err, files.ErrNotConfigured) {
			slog.WarnContext(ctx, "sign day photos", "err", err)
		}
		return out
	}
	for a, p := range pathOf {
		out[a] = signed[p]
	}
	return out
}
