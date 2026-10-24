//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

// TestDayOrders: orders are the day's in WIB (23:30 stays, 00:30 is the next day), page by
// page each once, with their items; hours and totals over the same day.
func TestDayOrders(t *testing.T) {
	pool := testkit.DB(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `INSERT INTO public.tenant_products (id, tenant_id, name, price) VALUES ($1, $2, 'Tea', 8000)`, teaA, tenantA); err != nil {
		t.Fatal(err)
	}
	// Times in UTC, as the old tables keep them: 08:10, 08:40, 10:05 and 23:30 WIB on 1 Oct,
	// 00:30 WIB on 2 Oct; and North's at 09:00.
	_, err := pool.Exec(ctx, `
		WITH o AS (
			INSERT INTO public.store_orders (store_id, user_id, total_amount, tenant_id, created_at) VALUES
			($1, $3, 8000, $4, '2026-10-01 01:10'), ($1, $3, 16000, $4, '2026-10-01 01:40'),
			($1, $3, 8000, $4, '2026-10-01 03:05'), ($1, $3, 24000, $4, '2026-10-01 16:30'),
			($1, $3, 8000, $4, '2026-10-01 17:30'), ($2, $3, 8000, $4, '2026-10-01 02:00')
			RETURNING id, total_amount)
		INSERT INTO public.store_order_items (order_id, product_id, quantity, unit_price, total_price, tenant_id)
		SELECT id, $5, total_amount / 8000, 8000, total_amount, $4 FROM o`,
		storeACentral, storeANorth, testkit.SellerA, tenantA, teaA)
	if err != nil {
		t.Fatal(err)
	}
	a := testkit.NewAPI(t, pool, "")
	admin := testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice"))
	get := func(path string, out any) int {
		t.Helper()
		resp := a.Request(t, http.MethodGet, "/tenants/tenant-a"+path, "backoffice", admin)
		_ = json.NewDecoder(resp.Body).Decode(out)
		return resp.StatusCode
	}

	var all []contract.Order
	cursor := ""
	for range 5 {
		var p struct {
			Items []contract.Order
			Next  string
		}
		if s := get("/orders?date=2026-10-01&limit=2&storeId="+storeACentral+"&cursor="+cursor, &p); s != 200 {
			t.Fatalf("page: %d", s)
		}
		all = append(all, p.Items...)
		if cursor = p.Next; cursor == "" {
			break
		}
	}
	if len(all) != 4 || all[0].Total != 24000 || all[0].At != "2026-10-01T16:30:00Z" || all[3].Total != 8000 {
		t.Fatalf("orders: %+v", all)
	}
	if o := all[0]; o.Cups != 3 || len(o.Items) != 1 || o.Items[0].Name != "Tea" || o.Seller != "Seller A" || o.StoreName != "A Central" {
		t.Errorf("first order: %+v", o)
	}

	var hours contract.SalesHoursOutput
	get("/sales/hours?date=2026-10-01", &hours.Body)
	h := hours.Body
	// All stores: Central's four and North's one; hours 7 (the one before) to 23 (the last).
	if h.Orders != 5 || h.Cups != 8 || h.Sales != 64000 || len(h.Hours) != 17 || h.Hours[0].Hour != 7 || h.Hours[len(h.Hours)-1].Hour != 23 {
		t.Fatalf("hours: %+v", h)
	}
	if h.Hours[1].Hour != 8 || h.Hours[1].Cups != 3 || h.Hours[1].Orders != 2 {
		t.Errorf("08:00: %+v", h.Hours[1])
	}
	var empty contract.SalesHoursOutput
	if get("/sales/hours?date=2026-09-30", &empty.Body); empty.Body.Orders != 0 || len(empty.Body.Hours) != 0 {
		t.Errorf("a day without sales: %+v", empty.Body)
	}
	if s := get("/orders?date=2026-10-01&cursor=junk", &struct{}{}); s != http.StatusBadRequest {
		t.Errorf("a bad cursor: %d", s)
	}
}
