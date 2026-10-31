package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
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
			session, err := q.TransferStoreSession(ctx, store.TransferStoreSessionParams{
				TenantID: caller.TenantID, StoreID: s, UserID: caller.UserID,
				ClaimCode: in.Body.ClaimCode, NewClaimCode: claimCode(),
			})
			if err != nil {
				var pg *pgconn.PgError
				if errors.As(err, &pg) {
					switch pg.Code {
					case "PT403":
						return nil, errBadClaimCode
					case "PT404":
						return nil, errNoSession
					case "PT409":
						return nil, errSessionTaken
					}
				}
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
