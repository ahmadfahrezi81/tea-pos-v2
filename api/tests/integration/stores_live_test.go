//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

// TestStoresLive: open stores first with who is selling; today's orders only, cups from their
// items; a closed store says when it last closed; a guest may look.
func TestStoresLive(t *testing.T) {
	pool := testkit.DB(t)
	ctx := context.Background()
	for _, q := range []string{
		`INSERT INTO public.tenant_products (id, tenant_id, name, price) VALUES ($5, $4, 'Tea', 8000)`,
		`INSERT INTO public.store_daily_summaries (id, store_id, opened_by, date, tenant_id, closed_at) VALUES
			('00000000-0000-0000-0090-00000000000a', $1, $3, (now() AT TIME ZONE 'Asia/Jakarta')::date, $4, NULL),
			('00000000-0000-0000-0091-00000000000a', $2, $3, (now() AT TIME ZONE 'Asia/Jakarta')::date - 1, $4, '2026-10-01 14:00')`,
		`INSERT INTO public.store_sessions (tenant_id, store_id, daily_summary_id, user_id, claim_code, started_at)
			VALUES ($4, $1, '00000000-0000-0000-0090-00000000000a', $3, 'ABC123', now() - interval '1 hour')`,
		`WITH o AS (
			INSERT INTO public.store_orders (store_id, user_id, total_amount, tenant_id, created_at) VALUES
			($1, $3, 16000, $4, now() AT TIME ZONE 'UTC'), ($1, $3, 8000, $4, (now() AT TIME ZONE 'UTC') - interval '2 days')
			RETURNING id, total_amount)
		INSERT INTO public.store_order_items (order_id, product_id, quantity, unit_price, total_price, tenant_id)
		SELECT id, $5, total_amount / 8000, 8000, total_amount, $4 FROM o`,
	} {
		if _, err := pool.Exec(ctx, strings.NewReplacer("$1", quote(storeACentral), "$2", quote(storeANorth), "$3", quote(testkit.SellerA), "$4", quote(tenantA), "$5", quote(teaA)).Replace(q)); err != nil {
			t.Fatal(err)
		}
	}
	a := testkit.NewAPI(t, pool, "")
	guest := testkit.Session(a.SignIn(t, testkit.GuestA, "backoffice"))
	resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/stores/live", "backoffice", guest)
	if resp.StatusCode != 200 {
		t.Fatalf("status %d", resp.StatusCode)
	}
	var out contract.StoresLiveOutput
	if err := json.NewDecoder(resp.Body).Decode(&out.Body); err != nil {
		t.Fatal(err)
	}
	s := out.Body.Stores
	if len(s) != 3 || s[0].Name != "A Central" || !s[0].Open || s[0].SellerName != "Seller A" || s[0].OpenSince == nil {
		t.Fatalf("stores: %+v", s)
	}
	if s[0].Orders != 1 || s[0].Cups != 2 || s[0].Sales != 16000 {
		t.Errorf("today at Central: %+v", s[0])
	}
	// Closed ones by name: A Closed, then A North, which last closed on 1 Oct.
	if s[1].Name != "A Closed" || s[1].Open || s[2].Name != "A North" || s[2].LastClosed == nil || s[2].LastClosed.Format("2006-01-02T15:04") != "2026-10-01T14:00" {
		t.Errorf("closed: %+v, %+v", s[1], s[2])
	}
}

func quote(id string) string { return "'" + id + "'" }
