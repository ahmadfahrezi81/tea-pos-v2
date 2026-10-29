//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

const storeANorth = "00000000-0000-0000-0011-00000000000a"

// daySummaries: Central sold on the 1st and 2nd (the 2nd not closed), North on the 1st,
// and Tenant B's store on the 1st, which Tenant A never sees.
func daySummaries(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	_, err := pool.Exec(context.Background(), `
		INSERT INTO public.store_daily_summaries (store_id, tenant_id, opened_by, date, total_sales, total_orders, total_cups, closed_at) VALUES
		($1, $4, $5, '2026-10-01', 100000, 10, 20, now()),
		($1, $4, $5, '2026-10-02', 50000, 5, 9, NULL),
		($2, $4, $5, '2026-10-01', 30000, 3, 6, now()),
		($3, $6, $7, '2026-10-01', 999000, 99, 99, now())`,
		storeACentral, storeANorth, storeBCentral, tenantA, testkit.SellerA,
		"00000000-0000-0000-0000-00000000000b", testkit.SellerB)
	if err != nil {
		t.Fatal(err)
	}
}

func TestSalesDays(t *testing.T) {
	pool := testkit.DB(t)
	daySummaries(t, pool)
	a := testkit.NewAPI(t, pool, "")
	admin := testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice"))
	get := func(query string) (int, []contract.SalesDay) {
		resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/sales/days?"+query, "backoffice", admin)
		var out struct{ Days []contract.SalesDay }
		_ = json.NewDecoder(resp.Body).Decode(&out)
		return resp.StatusCode, out.Days
	}

	// All stores: the tenant's two stores added up per day; the other tenant's not.
	status, days := get("from=2026-10-01&to=2026-10-31")
	if status != 200 || len(days) != 2 {
		t.Fatalf("all stores: %d %+v", status, days)
	}
	if d := days[0]; d.Date != "2026-10-01" || d.Sales != 130000 || d.Orders != 13 || d.Cups != 26 || d.Stores != 2 || d.NotClosed != 0 {
		t.Errorf("the 1st: %+v", d)
	}
	if d := days[1]; d.Date != "2026-10-02" || d.Cups != 9 || d.Stores != 1 || d.NotClosed != 1 {
		t.Errorf("the 2nd: %+v", d)
	}
	// One store.
	if _, days := get("from=2026-10-01&to=2026-10-01&storeId=" + storeANorth); len(days) != 1 || days[0].Sales != 30000 {
		t.Errorf("North: %+v", days)
	}
	// Refused: another tenant's store, a backwards or too long range.
	for query, want := range map[string]int{
		"from=2026-10-01&to=2026-10-31&storeId=" + storeBCentral: http.StatusNotFound,
		"from=2026-10-31&to=2026-10-01":                          http.StatusBadRequest,
		"from=2025-01-01&to=2026-10-31":                          http.StatusBadRequest,
	} {
		if status, _ := get(query); status != want {
			t.Errorf("%s: %d, want %d", query, status, want)
		}
	}
	// Only admins: a seller of the tenant is refused.
	seller := testkit.Session(a.SignIn(t, testkit.SellerA, "seller"))
	if resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/sales/days?from=2026-10-01&to=2026-10-31", "seller", seller); resp.StatusCode != http.StatusForbidden {
		t.Errorf("seller: %d", resp.StatusCode)
	}
}
