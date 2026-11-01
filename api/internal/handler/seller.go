package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"math/rand/v2"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/files"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/idem"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/realtime"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

var (
	sellerAccess = auth.App("seller", auth.Member)
	sellerWrite  = auth.App("seller", auth.Member).Idempotent()

	errNotYourStore   = httpx.New(http.StatusForbidden, "not_your_store", "You are not assigned to this store")
	errStoreOpened    = httpx.New(http.StatusConflict, "store_already_opened", "This store is already open today")
	errDayClosed      = httpx.New(http.StatusConflict, "day_closed", "This store has closed for today")
	errStoreNotOpen   = httpx.New(http.StatusConflict, "store_not_open", "This store is not open")
	errSessionTaken   = httpx.New(http.StatusConflict, "session_taken", "Someone is already selling at this store")
	errBadClaimCode   = httpx.New(http.StatusForbidden, "bad_claim_code", "That code is not right")
	errNoSession      = httpx.New(http.StatusConflict, "no_session", "Nobody is selling at this store")
	errProductChanged = httpx.New(http.StatusConflict, "product_changed", "A product or its price changed: check the cart")
	errBadPhoto       = httpx.New(http.StatusUnprocessableEntity, "bad_photo", "That photo did not upload here: take it again")
)

// orderChanged and dayChanged: the seller's and backoffice's screens refetch.
const (
	orderChanged = "order"
	dayChanged   = "day"
)

// claimCode is the two digits a seller reads out to hand the store over.
func claimCode() string { return fmt.Sprintf("%d", 10+rand.IntN(90)) }

func wibToday() time.Time {
	now := time.Now().In(domain.WIB)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

// assignedStore is the store in the path, if the caller works there.
func assignedStore(ctx context.Context, q *store.Queries, caller auth.Caller, id string) (pgtype.UUID, error) {
	s, err := uuid(id, errStoreNotFound)
	if err != nil {
		return s, err
	}
	ok, err := q.StoreAssigned(ctx, store.StoreAssignedParams{UserID: caller.UserID, StoreID: s, TenantID: caller.TenantID})
	if err == nil && !ok {
		err = errNotYourStore
	}
	return s, err
}

func logStoreActivity(ctx context.Context, q *store.Queries, caller auth.Caller, s, day pgtype.UUID, kind string, ref pgtype.UUID, refTable string, meta map[string]any) error {
	data, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	return q.LogStoreActivity(ctx, store.LogStoreActivityParams{
		TenantID: caller.TenantID, UserID: caller.UserID, StoreID: s, DailySummaryID: day,
		Type: kind, RefID: ref, RefTable: pgtype.Text{String: refTable, Valid: true}, Metadata: data,
	})
}

func announceStore(ctx context.Context, q *store.Queries, caller auth.Caller, s pgtype.UUID, kind string) error {
	for _, topic := range []string{realtime.StoreTopic(s.String()), realtime.TenantTopic(caller.TenantID.String())} {
		if err := realtime.Announce(ctx, q, realtime.Event{Topic: topic, Kind: kind}); err != nil {
			return err
		}
	}
	return nil
}

func storeGate(ctx context.Context, q *store.Queries, caller auth.Caller, s pgtype.UUID) (contract.StoreGate, error) {
	today := wibToday()
	g := contract.StoreGate{Gate: "no_day", Date: today.Format(time.DateOnly)}
	day, err := q.GetStoreDay(ctx, store.GetStoreDayParams{StoreID: s, TenantID: caller.TenantID, Date: date(today)})
	if errors.Is(err, pgx.ErrNoRows) {
		return g, nil
	}
	if err != nil {
		return g, err
	}
	g.DayID, g.OpeningBalance, g.Sales = day.ID.String(), int64(day.OpeningBalance), int64(day.TotalSales)
	g.Orders, g.Cups, g.Expenses, g.ExpectedCash = int64(day.TotalOrders), int64(day.TotalCups), day.TotalExpenses, int64(day.ExpectedCash)
	if day.ClosedAt.Valid {
		at := day.ClosedAt.Time.UTC()
		g.Gate, g.ClosedAt = "closed", &at
		return g, nil
	}
	session, err := q.GetActiveStoreSession(ctx, store.GetActiveStoreSessionParams{StoreID: s, TenantID: caller.TenantID})
	if errors.Is(err, pgx.ErrNoRows) {
		g.Gate = "no_session"
		return g, nil
	}
	if err != nil {
		return g, err
	}
	at := session.StartedAt.Time
	g.Gate, g.SessionID, g.SellerID, g.SellerName = "open", session.ID.String(), session.UserID.String(), session.FullName
	g.SellerAvatar, g.StartedAt = session.AvatarUrl, &at
	if session.UserID == caller.UserID {
		g.ClaimCode = session.ClaimCode
	}
	return g, nil
}

func registerSeller(api huma.API, d Deps) {
	op := func(id, method, path, summary string) huma.Operation {
		return huma.Operation{OperationID: id, Method: method, Path: "/tenants/{tenant}" + path, Summary: summary, Tags: []string{"seller"}}
	}

	route(api, op("listProducts", http.MethodGet, "/products", "What the stores sell"), sellerAccess,
		func(ctx context.Context, _ *contract.TenantInput) (*contract.ProductsOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			rows, err := d.Queries.ListSellerProducts(ctx, caller.TenantID)
			if err != nil {
				return nil, err
			}
			out := &contract.ProductsOutput{}
			out.Body.Products = make([]contract.Product, len(rows))
			for i, r := range rows {
				out.Body.Products[i] = contract.Product{ID: r.ID.String(), Name: r.Name, Price: int64(r.Price), ImageURL: r.ImageUrl}
				if r.CategoryID.Valid {
					out.Body.Products[i].CategoryID = r.CategoryID.String()
				}
			}
			return out, nil
		})

	route(api, op("getStoreGate", http.MethodGet, "/stores/{storeId}/gate", "Today at a store: open it, resume, take over or sell"), sellerAccess,
		func(ctx context.Context, in *contract.SellerStoreInput) (*contract.StoreGateOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			s, err := assignedStore(ctx, d.Queries, caller, in.StoreID)
			if err != nil {
				return nil, err
			}
			g, err := storeGate(ctx, d.Queries, caller, s)
			if err != nil {
				return nil, err
			}
			return &contract.StoreGateOutput{Body: g}, nil
		})

	route(api, op("openStore", http.MethodPost, "/stores/{storeId}/open", "Open a store for today: its day and the caller's session, together"), sellerWrite,
		func(ctx context.Context, in *contract.OpenStoreInput) (*contract.StoreGateOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			q := idem.Queries(ctx, d.Queries)
			s, err := assignedStore(ctx, q, caller, in.StoreID)
			if err != nil {
				return nil, err
			}
			today := wibToday()
			start := today.Add(-7 * time.Hour)
			totals, err := q.DayOrderTotals(ctx, store.DayOrderTotalsParams{StoreID: s, TenantID: caller.TenantID,
				DayStart: pgtype.Timestamp{Time: start, Valid: true}, DayEnd: pgtype.Timestamp{Time: start.Add(24 * time.Hour), Valid: true}})
			if err != nil {
				return nil, err
			}
			var breakdown []byte
			if in.Body.CashBreakdown != nil {
				if breakdown, err = json.Marshal(in.Body.CashBreakdown); err != nil {
					return nil, err
				}
			}
			day, err := q.CreateStoreDay(ctx, store.CreateStoreDayParams{
				StoreID: s, TenantID: caller.TenantID, OpenedBy: caller.UserID, Date: date(today),
				OpeningBalance: int32(in.Body.OpeningBalance), OpeningCashBreakdown: breakdown,
				TotalSales: totals.Sales, TotalOrders: totals.Orders, TotalCups: totals.Cups,
				ExpectedCash: int32(in.Body.OpeningBalance) + totals.Sales,
			})
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errStoreOpened
			}
			if err != nil {
				return nil, err
			}
			if err := startSession(ctx, q, caller, s, day); err != nil {
				return nil, err
			}
			if in.Body.PhotoURL != "" {
				if err := saveDayPhoto(ctx, q, caller, s, day, "opening", in.Body.PhotoURL, nil); err != nil {
					return nil, err
				}
			}
			if err := logStoreActivity(ctx, q, caller, s, day, "store_opened", day, "store_daily_summaries",
				map[string]any{"date": today.Format(time.DateOnly), "opening_balance": in.Body.OpeningBalance}); err != nil {
				return nil, err
			}
			return gateAfter(ctx, q, caller, s)
		})

	route(api, op("resumeStore", http.MethodPost, "/stores/{storeId}/resume", "Start selling at a store that is open with nobody on it"), sellerWrite,
		func(ctx context.Context, in *contract.SellerStoreInput) (*contract.StoreGateOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			q := idem.Queries(ctx, d.Queries)
			s, err := assignedStore(ctx, q, caller, in.StoreID)
			if err != nil {
				return nil, err
			}
			day, err := q.GetStoreDay(ctx, store.GetStoreDayParams{StoreID: s, TenantID: caller.TenantID, Date: date(wibToday())})
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errStoreNotOpen
			}
			if err != nil {
				return nil, err
			}
			if day.ClosedAt.Valid {
				return nil, errDayClosed
			}
			if err := startSession(ctx, q, caller, s, day.ID); err != nil {
				return nil, err
			}
			if err := logStoreActivity(ctx, q, caller, s, day.ID, "store_opened", day.ID, "store_daily_summaries", map[string]any{"resumed": true}); err != nil {
				return nil, err
			}
			return gateAfter(ctx, q, caller, s)
		})

	route(api, op("takeOverStore", http.MethodPost, "/stores/{storeId}/take-over", "Take over from whoever is selling, with their code"), sellerWrite,
		func(ctx context.Context, in *contract.TransferSessionInput) (*contract.StoreGateOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			q := idem.Queries(ctx, d.Queries)
			s, err := assignedStore(ctx, q, caller, in.StoreID)
			if err != nil {
				return nil, err
			}
			// Checked first: an exception from the function would abort the write's transaction, and
			// with it the saved answer. The function still locks the row against a race.
			current, err := q.GetActiveStoreSession(ctx, store.GetActiveStoreSessionParams{StoreID: s, TenantID: caller.TenantID})
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errNoSession
			}
			if err != nil {
				return nil, err
			}
			if current.ClaimCode != in.Body.ClaimCode {
				return nil, errBadClaimCode
			}
			session, err := q.TransferStoreSession(ctx, store.TransferStoreSessionParams{
				TenantID: caller.TenantID, StoreID: s, UserID: caller.UserID,
				ClaimCode: in.Body.ClaimCode, NewClaimCode: claimCode(),
			})
			if err != nil {
				return nil, err
			}
			if err := logStoreActivity(ctx, q, caller, s, session.DailySummaryID, "session_transferred", session.ID, "store_sessions",
				map[string]any{"daily_summary_id": session.DailySummaryID.String()}); err != nil {
				return nil, err
			}
			return gateAfter(ctx, q, caller, s)
		})

	route(api, op("createOrder", http.MethodPost, "/stores/{storeId}/orders", "Save an order, its items and the day's totals, together"), sellerWrite,
		func(ctx context.Context, in *contract.CreateOrderInput) (*contract.CreateOrderOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			q := idem.Queries(ctx, d.Queries)
			s, err := assignedStore(ctx, q, caller, in.StoreID)
			if err != nil {
				return nil, err
			}
			day, err := q.GetStoreDay(ctx, store.GetStoreDayParams{StoreID: s, TenantID: caller.TenantID, Date: date(wibToday())})
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errStoreNotOpen
			}
			if err != nil {
				return nil, err
			}
			if day.ClosedAt.Valid {
				return nil, errDayClosed
			}

			ids := make([]pgtype.UUID, len(in.Body.Items))
			for i, it := range in.Body.Items {
				if ids[i], err = uuid(it.ProductID, errProductChanged); err != nil {
					return nil, err
				}
			}
			rows, err := q.ActiveProductPrices(ctx, store.ActiveProductPricesParams{TenantID: caller.TenantID, Ids: ids})
			if err != nil {
				return nil, err
			}
			prices := make(map[pgtype.UUID]int32, len(rows))
			for _, r := range rows {
				prices[r.ID] = r.Price
			}
			var total, cups int32
			for i, it := range in.Body.Items {
				price, ok := prices[ids[i]]
				if !ok || price != it.UnitPrice {
					return nil, errProductChanged
				}
				total += price * it.Quantity
				cups += it.Quantity
			}

			order, err := q.CreateOrder(ctx, store.CreateOrderParams{
				StoreID: s, UserID: caller.UserID, TotalAmount: total, TenantID: caller.TenantID, DailySummaryID: day.ID,
			})
			if err != nil {
				return nil, err
			}
			for i, it := range in.Body.Items {
				if err := q.CreateOrderItem(ctx, store.CreateOrderItemParams{
					OrderID: order, ProductID: ids[i], Quantity: it.Quantity, UnitPrice: it.UnitPrice,
					TotalPrice: it.UnitPrice * it.Quantity, TenantID: caller.TenantID,
				}); err != nil {
					return nil, err
				}
			}
			if err := q.AddOrderToDay(ctx, store.AddOrderToDayParams{Amount: total, Cups: cups, ID: day.ID, TenantID: caller.TenantID}); err != nil {
				return nil, err
			}
			if err := logStoreActivity(ctx, q, caller, s, day.ID, "order_created", order, "store_orders",
				map[string]any{"total_amount": total, "total_cups": cups, "payment_method": "cash"}); err != nil {
				return nil, err
			}
			if err := announceStore(ctx, q, caller, s, orderChanged); err != nil {
				return nil, err
			}
			out := &contract.CreateOrderOutput{}
			out.Body.ID, out.Body.Total = order.String(), int64(total)
			return out, nil
		})

	route(api, op("createExpense", http.MethodPost, "/stores/{storeId}/days/{dayId}/expenses", "Add an expense to the open day"), sellerWrite,
		func(ctx context.Context, in *contract.CreateExpenseInput) (*contract.StoreGateOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			q := idem.Queries(ctx, d.Queries)
			s, day, err := workingDay(ctx, q, caller, in.StoreID, in.DayID)
			if err != nil {
				return nil, err
			}
			expense, err := q.CreateExpense(ctx, store.CreateExpenseParams{
				DailySummaryID: day.ID, StoreID: s, Type: in.Body.Type, Amount: in.Body.Amount, TenantID: caller.TenantID, UserID: caller.UserID,
			})
			if err != nil {
				return nil, err
			}
			if err := q.AddExpenseToDay(ctx, store.AddExpenseToDayParams{Amount: in.Body.Amount, ID: day.ID, TenantID: caller.TenantID}); err != nil {
				return nil, err
			}
			if err := logStoreActivity(ctx, q, caller, s, day.ID, "expense_created", expense, "store_expenses",
				map[string]any{"amount": in.Body.Amount, "type": in.Body.Type}); err != nil {
				return nil, err
			}
			return gateAfter(ctx, q, caller, s)
		})

	route(api, op("saveDayPhoto", http.MethodPut, "/stores/{storeId}/days/{dayId}/photos/{type}", "Save a day's photo in its slot, replacing the one there"), sellerWrite,
		func(ctx context.Context, in *contract.SaveDayPhotoInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			q := idem.Queries(ctx, d.Queries)
			s, day, err := workingDay(ctx, q, caller, in.StoreID, in.DayID)
			if err != nil {
				return nil, err
			}
			return nil, saveDayPhoto(ctx, q, caller, s, day.ID, in.Type, in.Body.URL, in.Body.Quantity)
		})

	route(api, op("closeStoreDay", http.MethodPost, "/stores/{storeId}/days/{dayId}/close", "Close a day: final totals, sessions ended, commissions, claims and payouts, together"), sellerWrite,
		func(ctx context.Context, in *contract.CloseDayInput) (*contract.StoreGateOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			q := idem.Queries(ctx, d.Queries)
			s, day, err := workingDay(ctx, q, caller, in.StoreID, in.DayID)
			if err != nil {
				return nil, err
			}
			totals, err := q.DayFinalTotals(ctx, store.DayFinalTotalsParams{ID: day.ID, TenantID: caller.TenantID})
			if err != nil {
				return nil, err
			}
			expected := day.OpeningBalance + totals.Sales - totals.Expenses
			variance := in.Body.ActualCash - expected
			if err := q.CloseStoreDay(ctx, store.CloseStoreDayParams{
				ID: day.ID, TenantID: caller.TenantID, ClosedBy: caller.UserID,
				Sales: totals.Sales, Orders: totals.Orders, Cups: totals.Cups, Expenses: numeric(totals.Expenses),
				ExpectedCash: expected, ActualCash: pgtype.Int4{Int32: in.Body.ActualCash, Valid: true}, Variance: pgtype.Int4{Int32: variance, Valid: true},
			}); err != nil {
				return nil, err
			}
			if err := q.EndDaySessions(ctx, store.EndDaySessionsParams{DayID: day.ID, TenantID: caller.TenantID}); err != nil {
				return nil, err
			}
			if err := payDay(ctx, q, caller, s, day); err != nil {
				return nil, err
			}
			if err := logStoreActivity(ctx, q, caller, s, day.ID, "store_closed", day.ID, "store_daily_summaries",
				map[string]any{"total_sales": totals.Sales, "variance": variance}); err != nil {
				return nil, err
			}
			return gateAfter(ctx, q, caller, s)
		})
}

func numeric(n int32) pgtype.Numeric {
	return pgtype.Numeric{Int: big.NewInt(int64(n)), Valid: true}
}

// workingDay is the open day a write is about, locked: the caller works at the store, and if
// someone is selling on that day, it is them. An old day left open has no such holder to wait for.
func workingDay(ctx context.Context, q *store.Queries, caller auth.Caller, storeID, id string) (pgtype.UUID, store.LockStoreDayRow, error) {
	var day store.LockStoreDayRow
	s, err := assignedStore(ctx, q, caller, storeID)
	if err != nil {
		return s, day, err
	}
	dayUUID, err := dayID(id)
	if err != nil {
		return s, day, err
	}
	day, err = q.LockStoreDay(ctx, store.LockStoreDayParams{ID: dayUUID, StoreID: s, TenantID: caller.TenantID})
	if errors.Is(err, pgx.ErrNoRows) {
		return s, day, errDayNotFound
	}
	if err != nil {
		return s, day, err
	}
	if day.ClosedAt.Valid {
		return s, day, errDayClosed
	}
	holder, err := q.DayHolder(ctx, store.DayHolderParams{DayID: day.ID, TenantID: caller.TenantID})
	if err != nil {
		return s, day, err
	}
	if holder != "" && holder != caller.UserID.String() {
		return s, day, errSessionTaken
	}
	return s, day, nil
}

func saveDayPhoto(ctx context.Context, q *store.Queries, caller auth.Caller, s, day pgtype.UUID, kind, address string, quantity *contract.DayQuantity) error {
	bucket := files.Purposes["daily_photo"].Bucket
	if address != "" && !strings.HasPrefix(files.PathIn(bucket, address), caller.TenantID.String()+"/") {
		return errBadPhoto
	}
	var amount []byte
	if quantity != nil {
		var err error
		if amount, err = json.Marshal(quantity); err != nil {
			return err
		}
	}
	removed, err := q.DeleteDayPhoto(ctx, store.DeleteDayPhotoParams{DailySummaryID: day, TenantID: caller.TenantID, Type: kind})
	if err != nil {
		return err
	}
	event := "summary_photo_uploaded"
	if address == "" {
		// Only the quantity changed: the photo stays.
		if len(removed) == 0 {
			return errBadPhoto
		}
		address, event = removed[0].Url, "summary_photo_updated"
	}
	id, err := q.AddDayPhoto(ctx, store.AddDayPhotoParams{DailySummaryID: day, StoreID: s, TenantID: caller.TenantID, Type: kind, Url: address, Quantity: amount})
	if err != nil {
		return err
	}
	return logStoreActivity(ctx, q, caller, s, day, event, id, "store_daily_summary_photos",
		map[string]any{"photo_url": address, "slot": kind, "quantity": quantity})
}

// payDay is what closing a day earns: each person's commission and automatic claims, and their
// payout for the period. Inside the close: a day is never closed with its pay missing.
func payDay(ctx context.Context, q *store.Queries, caller auth.Caller, s pgtype.UUID, day store.LockStoreDayRow) error {
	commissions, err := q.CreateDayCommissions(ctx, store.CreateDayCommissionsParams{
		TenantID: caller.TenantID, StoreID: s, DayID: day.ID, Date: day.Date, NonSellerSlug: domain.NonSellerSlug,
	})
	if err != nil {
		return err
	}
	for _, c := range commissions {
		if err := logStoreActivity(ctx, q, caller, s, day.ID, "payroll_commission_updated", c.ID, "payroll_commissions", map[string]any{
			"user_id": c.UserID.String(), "total_cups": c.TotalCups, "total_orders": c.TotalOrders,
			"rate_per_cup": c.RatePerCup, "total_commission": c.TotalCommission,
		}); err != nil {
			return err
		}
	}
	claims, err := q.CreateDayAutoClaims(ctx, store.CreateDayAutoClaimsParams{TenantID: caller.TenantID, StoreID: s, DayID: day.ID, Date: day.Date})
	if err != nil {
		return err
	}
	for _, c := range claims {
		if err := logStoreActivity(ctx, q, caller, s, day.ID, "claim_submitted", c.ID, "payroll_claims", map[string]any{
			"claim_config_id": c.ClaimConfigID.String(), "amount": c.Amount, "date": day.Date.Time.Format(time.DateOnly),
		}); err != nil {
			return err
		}
	}
	people, err := q.DayPeople(ctx, store.DayPeopleParams{DayID: day.ID, TenantID: caller.TenantID})
	if err != nil {
		return err
	}
	return ensurePayouts(ctx, q, caller.TenantID, people, day.Date.Time)
}

func startSession(ctx context.Context, q *store.Queries, caller auth.Caller, s, day pgtype.UUID) error {
	_, err := q.CreateStoreSession(ctx, store.CreateStoreSessionParams{
		TenantID: caller.TenantID, StoreID: s, DailySummaryID: day, UserID: caller.UserID, ClaimCode: claimCode(),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return errSessionTaken
	}
	return err
}

// gateAfter tells the other phones and answers with the store as it now stands.
func gateAfter(ctx context.Context, q *store.Queries, caller auth.Caller, s pgtype.UUID) (*contract.StoreGateOutput, error) {
	if err := announceStore(ctx, q, caller, s, dayChanged); err != nil {
		return nil, err
	}
	g, err := storeGate(ctx, q, caller, s)
	if err != nil {
		return nil, err
	}
	return &contract.StoreGateOutput{Body: g}, nil
}

// ensurePayouts gives each person a payout for the period day falls in, and stamps their rows there.
func ensurePayouts(ctx context.Context, q *store.Queries, tenant pgtype.UUID, people []pgtype.UUID, day time.Time) error {
	frequency, err := q.GetPayFrequency(ctx, tenant)
	if err != nil {
		return err
	}
	start, end, err := domain.PayWindow(day, frequency)
	if err != nil {
		return err
	}
	if err := q.EnsurePayouts(ctx, store.EnsurePayoutsParams{TenantID: tenant, StartDate: date(start), EndDate: date(end), UserIds: people}); err != nil {
		return err
	}
	if err := q.StampCommissions(ctx, store.StampCommissionsParams{TenantID: tenant, StartDate: date(start), EndDate: date(end), UserIds: people}); err != nil {
		return err
	}
	return q.StampClaims(ctx, store.StampClaimsParams{TenantID: tenant, StartDate: date(start), EndDate: date(end), UserIds: people})
}
