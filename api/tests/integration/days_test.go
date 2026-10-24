//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

const (
	dayCentral = "00000000-0000-0000-0d01-00000000000a"
	dayNorth   = "00000000-0000-0000-0d02-00000000000a"
	dayB       = "00000000-0000-0000-0d01-00000000000b"
	teaA       = "00000000-0000-0000-0e01-00000000000a"
	milkA      = "00000000-0000-0000-0e02-00000000000a"
)

// oneDay: Central's 1 Oct, closed, with two sellers' orders of two products, an expense, a
// session handed over, its photos and its activity; North's 1 Oct, open; and Tenant B's day.
func oneDay(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	tenantB := "00000000-0000-0000-0000-00000000000b"
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO public.store_daily_summaries
		(id, store_id, tenant_id, opened_by, closed_by, date, opening_balance, total_sales, total_orders, total_cups, total_expenses, expected_cash, actual_cash, variance, notes, closed_at, created_at) VALUES
		($1, $2, $3, $4, $4, '2026-10-01', 50000, 40000, 3, 5, 10000, 80000, 79000, -1000, 'Short a coin', '2026-10-01 15:00', '2026-10-01 01:00'),
		($5, $6, $3, $4, NULL, '2026-10-01', 0, 0, 0, 0, 0, 0, NULL, NULL, NULL, NULL, '2026-10-01 01:00'),
		($7, $8, $9, $10, NULL, '2026-10-01', 0, 1, 1, 1, 0, 0, NULL, NULL, NULL, NULL, NULL)`,
		dayCentral, storeACentral, tenantA, testkit.SellerA, dayNorth, storeANorth, dayB, storeBCentral, tenantB, testkit.SellerB)
	exec(`INSERT INTO public.tenant_products (id, tenant_id, name, price) VALUES ($1, $3, 'Tea', 8000), ($2, $3, 'Milk Tea', 10000)`, teaA, milkA, tenantA)
	exec(`WITH o AS (
		INSERT INTO public.store_orders (store_id, user_id, total_amount, tenant_id, daily_summary_id, created_at) VALUES
		($1, $2, 16000, $4, $5, '2026-10-01 02:00'), ($1, $2, 8000, $4, $5, '2026-10-01 03:00'),
		($1, $3, 10000, $4, $5, '2026-10-01 04:00') RETURNING id, user_id, total_amount)
		INSERT INTO public.store_order_items (order_id, product_id, quantity, unit_price, total_price, tenant_id)
		SELECT id, CASE WHEN total_amount = 10000 THEN $7::uuid ELSE $6::uuid END, CASE total_amount WHEN 16000 THEN 2 ELSE 1 END, 8000, total_amount, $4 FROM o`,
		storeACentral, testkit.SellerA, testkit.AdminA, tenantA, dayCentral, teaA, milkA)
	exec(`INSERT INTO public.store_expenses (daily_summary_id, store_id, tenant_id, type, amount, notes) VALUES ($1, $2, $3, 'Ice', 10000, 'Two bags')`, dayCentral, storeACentral, tenantA)
	exec(`INSERT INTO public.store_sessions (id, tenant_id, store_id, daily_summary_id, user_id, claim_code, started_at, ended_at, status, previous_session_id) VALUES
		('00000000-0000-0000-5e51-00000000000a', $1, $2, $3, $4, 'AAA111', '2026-10-01 01:00Z', '2026-10-01 08:00Z', 'ended', NULL),
		('00000000-0000-0000-5e52-00000000000a', $1, $2, $3, $5, 'BBB222', '2026-10-01 08:00Z', NULL, 'active', '00000000-0000-0000-5e51-00000000000a')`,
		tenantA, storeACentral, dayCentral, testkit.SellerA, testkit.AdminA)
	exec(`INSERT INTO public.store_daily_summary_photos (daily_summary_id, store_id, tenant_id, type, url, quantity) VALUES
		($1, $2, $3, 'opening', 'https://old.test/storage/v1/object/public/daily-photos/a/opening.jpg', NULL),
		($1, $2, $3, 'closing:tea', 'https://old.test/storage/v1/object/public/daily-photos/a/closing:tea.jpg', '{"value": 1.5, "unit": "L"}')`,
		dayCentral, storeACentral, tenantA)
	exec(`INSERT INTO public.tenant_activity_logs (tenant_id, user_id, store_id, type, metadata, daily_summary_id, created_at) VALUES
		($1, $2, $3, 'store_opened', '{"opening_balance": 50000}', $4, '2026-10-01 01:00Z'),
		($1, $2, $3, 'summary_photo_uploaded', '{"slot": "opening", "photo_url": "https://old.test/storage/v1/object/public/daily-photos/a/opening.jpg"}', $4, '2026-10-01 01:01Z'),
		($1, $2, $3, 'payroll_entry_updated', '{}', $4, '2026-10-01 02:00Z')`,
		tenantA, testkit.SellerA, storeACentral, dayCentral)
}

// fakeStorage signs whatever it is asked, as Storage would for files it holds.
func fakeStorage(t *testing.T) string {
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var in struct{ Paths []string }
		_ = json.NewDecoder(r.Body).Decode(&in)
		out := []map[string]any{}
		for _, p := range in.Paths {
			out = append(out, map[string]any{"path": p, "signedURL": "/object/sign/daily-photos/" + p + "?token=t"})
		}
		_ = json.NewEncoder(w).Encode(out)
	}))
	t.Cleanup(fake.Close)
	return fake.URL
}

func TestDays(t *testing.T) {
	pool := testkit.DB(t)
	oneDay(t, pool)
	storage := fakeStorage(t)
	a := testkit.NewAPIWith(t, pool, testkit.Options{StorageURL: storage})
	admin := testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice"))
	get := func(path string, out any) int {
		t.Helper()
		resp := a.Request(t, http.MethodGet, "/tenants/tenant-a"+path, "backoffice", admin)
		_ = json.NewDecoder(resp.Body).Decode(out)
		return resp.StatusCode
	}

	// The month: both of Tenant A's days, with expenses and sellers; Tenant B's not.
	var month struct{ Days []contract.Day }
	if s := get("/days?month=2026-10", &month); s != 200 || len(month.Days) != 2 {
		t.Fatalf("month: %d %+v", s, month.Days)
	}
	c := month.Days[0]
	if c.ID != dayCentral || c.StoreName != "A Central" || c.Sales != 40000 || c.ActualCash == nil || *c.Variance != -1000 || c.ClosedAt != "2026-10-01T15:00:00Z" {
		t.Errorf("Central: %+v", c)
	}
	if len(c.ExpenseItems) != 1 || c.ExpenseItems[0].Amount != 10000 {
		t.Errorf("expenses: %+v", c.ExpenseItems)
	}
	if len(c.Sellers) != 2 || c.Sellers[0].UserID != testkit.SellerA || c.Sellers[0].Cups != 3 || c.Sellers[1].Cups != 1 {
		t.Errorf("sellers: %+v", c.Sellers)
	}
	if n := month.Days[1]; n.ID != dayNorth || n.ClosedAt != "" || n.ActualCash != nil || len(n.Sellers) != 0 {
		t.Errorf("North: %+v", n)
	}

	// One day: who opened and closed, products, photos signed and their quantities.
	var detail contract.DayDetail
	if s := get("/days/"+dayCentral, &detail); s != 200 {
		t.Fatalf("day: %d", s)
	}
	if detail.OpenedBy != "Seller A" || detail.OpenedAt != "2026-10-01T01:00:00Z" || len(detail.Products) != 2 || detail.Products[0].Name != "Tea" || detail.Products[0].Quantity != 3 {
		t.Errorf("day: %+v", detail)
	}
	if len(detail.Photos) != 2 || !strings.HasPrefix(detail.Photos[0].URL, storage+"/storage/v1/object/sign/daily-photos/a/opening.jpg") ||
		detail.Photos[1].Quantity == nil || detail.Photos[1].Quantity.Value != 1.5 {
		t.Errorf("photos: %+v", detail.Photos)
	}

	// Activity: the day's events only (not payroll), the photo address signed.
	var activity struct{ Events []contract.DayEvent }
	get("/days/"+dayCentral+"/activity", &activity)
	if len(activity.Events) != 2 || activity.Events[0].Type != "store_opened" || activity.Events[0].UserName != "Seller A" ||
		!strings.Contains(string(activity.Events[1].Metadata), storage) {
		t.Errorf("activity: %+v", activity.Events)
	}

	// Sessions: the handover is named.
	var sessions struct{ Sessions []contract.DaySession }
	get("/days/"+dayCentral+"/sessions", &sessions)
	if len(sessions.Sessions) != 2 || sessions.Sessions[1].PreviousSessionID != sessions.Sessions[0].ID || sessions.Sessions[1].EndedAt != "" {
		t.Errorf("sessions: %+v", sessions.Sessions)
	}

	// Products and tea waste over the month.
	var products struct{ Products []contract.SalesProduct }
	get("/sales/products?from=2026-10-01&to=2026-10-31", &products)
	if len(products.Products) != 2 || products.Products[0].Name != "Tea" || products.Products[0].Quantity != 3 {
		t.Errorf("products: %+v", products.Products)
	}
	var tea struct{ Days []contract.TeaWasteDay }
	get("/tea-waste?from=2026-10-01&to=2026-10-31&storeId="+storeACentral, &tea)
	if len(tea.Days) != 1 || tea.Days[0].Litres != 1.5 {
		t.Errorf("tea waste: %+v", tea.Days)
	}

	// Another tenant's day is not found, through every route.
	for _, p := range []string{"/days/" + dayB, "/days/" + dayB + "/activity", "/days/" + dayB + "/sessions"} {
		var e struct{ Code string }
		if s := get(p, &e); s != http.StatusNotFound || e.Code != "day_not_found" {
			t.Errorf("%s: %d %s", p, s, e.Code)
		}
	}
	if s := get("/days/not-a-day", &struct{}{}); s != http.StatusBadRequest {
		t.Errorf("not a day: %d", s)
	}
}
