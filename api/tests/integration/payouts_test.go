//go:build integration

package integration

import (
	"context"
	"net/http"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

const (
	payoutOpen = "00000000-0000-0000-9a01-00000000000a"
	payoutPaid = "00000000-0000-0000-9a02-00000000000a"
	payoutB    = "00000000-0000-0000-9a01-00000000000b"
)

// twoPayouts: Seller A's open payout for 12-25 Oct 2026 (two days: the 13th with a commission
// and a claim pending, the 14th with an approved commission and a rejected claim), their paid one
// for 28 Sep-11 Oct, and Tenant B's.
func twoPayouts(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO payroll_commission_configs (id, tenant_id, name, slug, rate_per_cup) VALUES ('00000000-0000-0000-c001-00000000000a', $1, 'Std', 'SELLER_STD', 1000)`, tenantA)
	exec(`INSERT INTO payroll_user_info (tenant_id, user_id, commission_config_id) VALUES ($1, $2, '00000000-0000-0000-c001-00000000000a')`, tenantA, testkit.SellerA)
	exec(`INSERT INTO payroll_payouts (id, tenant_id, user_id, start_date, end_date, status) VALUES
		($1, $4, $6, '2026-10-12', '2026-10-25', 'pending'),
		($2, $4, $6, '2026-09-28', '2026-10-11', 'paid'),
		($3, $5, $7, '2026-10-12', '2026-10-25', 'pending')`,
		payoutOpen, payoutPaid, payoutB, tenantA, "00000000-0000-0000-0000-00000000000b", testkit.SellerA, testkit.SellerB)
	exec(`INSERT INTO store_daily_summaries (id, store_id, tenant_id, opened_by, date) VALUES
		('00000000-0000-0000-0d13-00000000000a', $1, $2, $3, '2026-10-13'),
		('00000000-0000-0000-0d14-00000000000a', $1, $2, $3, '2026-10-14'),
		('00000000-0000-0000-0d10-00000000000a', $1, $2, $3, '2026-10-10')`, storeACentral, tenantA, testkit.SellerA)
	exec(`INSERT INTO payroll_commissions (id, tenant_id, store_id, user_id, daily_summary_id, date, total_cups, total_orders, rate_per_cup, total_commission, status, payout_id) VALUES
		('00000000-0000-0000-cc13-00000000000a', $1, $2, $3, '00000000-0000-0000-0d13-00000000000a', '2026-10-13', 40, 30, 1000, 40000, 'pending', $4),
		('00000000-0000-0000-cc14-00000000000a', $1, $2, $3, '00000000-0000-0000-0d14-00000000000a', '2026-10-14', 50, 35, 1000, 50000, 'approved', $4),
		('00000000-0000-0000-cc10-00000000000a', $1, $2, $3, '00000000-0000-0000-0d10-00000000000a', '2026-10-10', 10, 8, 1000, 10000, 'approved', $5)`,
		tenantA, storeACentral, testkit.SellerA, payoutOpen, payoutPaid)
	exec(`INSERT INTO payroll_claims (id, tenant_id, user_id, amount, date, status, payout_id) VALUES
		('00000000-0000-0000-ce13-00000000000a', $1, $2, 15000, '2026-10-13', 'pending', $3),
		('00000000-0000-0000-ce14-00000000000a', $1, $2, 9000, '2026-10-14', 'rejected', $3),
		('00000000-0000-0000-ce10-00000000000a', $1, $2, 5000, '2026-10-10', 'pending', $4)`,
		tenantA, testkit.SellerA, payoutOpen, payoutPaid)
}

func TestPayouts(t *testing.T) {
	pool := testkit.DB(t)
	twoPayouts(t, pool)
	a := testkit.NewAPI(t, pool, "")
	c := &payClient{t: t, a: a, admin: testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice"))}

	// Its period: Seller A's open payout; Tenant B's is not listed.
	var at contract.PayPeriodAt
	if s := c.get("/periods/2026-10-12", &at); s != 200 || len(at.People) != 1 {
		t.Fatalf("period: %d %+v", s, at.People)
	}
	open := at.People[0]
	if open.ID != payoutOpen || open.Commissions != 50000 || open.Claims != 0 || open.Total != 50000 || open.Cups != 50 || open.Approved != 1 || open.Pending != 2 || open.NonSeller {
		t.Errorf("open payout: %+v", open)
	}

	// The payslip: the same totals, every row.
	var slip contract.Payslip
	if s := c.get("/payouts/"+payoutOpen, &slip); s != 200 {
		t.Fatalf("payslip: %d", s)
	}
	if slip.Total != open.Total || len(slip.Commissions) != 2 || len(slip.Claims) != 2 || slip.RatePerCup != 1000 || slip.Name != "Seller A" {
		t.Errorf("payslip: %+v", slip)
	}

	// Approve the 13th as a day: its two pending rows, nothing else; again, nothing more.
	var review contract.ReviewDayOutput
	c.write(http.MethodPost, "/payouts/"+payoutOpen+"/days/2026-10-13/review", `{"status":"approved"}`, &review.Body)
	if review.Body.Commissions != 1 || review.Body.Claims != 1 {
		t.Errorf("review: %+v", review.Body)
	}
	c.write(http.MethodPost, "/payouts/"+payoutOpen+"/days/2026-10-13/review", `{"status":"rejected"}`, &review.Body)
	if review.Body.Commissions != 0 || review.Body.Claims != 0 {
		t.Errorf("second review overturned a decision: %+v", review.Body)
	}
	c.get("/payouts/"+payoutOpen, &slip)
	if slip.Total != 105000 || slip.Pending != 0 || slip.Approved != 3 {
		t.Errorf("after review: total %d, pending %d, approved %d", slip.Total, slip.Pending, slip.Approved)
	}
	if s := c.write(http.MethodPost, "/payouts/"+payoutOpen+"/days/2026-10-30/review", `{"status":"approved"}`, nil); s != http.StatusBadRequest {
		t.Errorf("a day outside the period: %d", s)
	}

	// One row at a time, and the activity log, as the old app writes it.
	if s := c.write(http.MethodPut, "/claims/00000000-0000-0000-ce14-00000000000a", `{"status":"approved"}`, nil); s != 204 {
		t.Errorf("claim: %d", s)
	}
	if s := c.write(http.MethodPut, "/commissions/00000000-0000-0000-cc14-00000000000a", `{"status":"rejected"}`, nil); s != 204 {
		t.Errorf("commission: %d", s)
	}
	if n := count(t, pool, `SELECT count(*) FROM tenant_activity_logs WHERE type IN ('payroll_commission_updated', 'claim_status_updated')`); n != 4 {
		t.Errorf("activity entries: %d, want 4 (day: 2, rows: 2)", n)
	}

	// A paid payout's rows are history: every way in is refused.
	for _, w := range []struct{ method, path, body string }{
		{http.MethodPut, "/commissions/00000000-0000-0000-cc10-00000000000a", `{"status":"rejected"}`},
		{http.MethodPut, "/claims/00000000-0000-0000-ce10-00000000000a", `{"status":"approved"}`},
		{http.MethodPost, "/payouts/" + payoutPaid + "/days/2026-10-10/review", `{"status":"approved"}`},
	} {
		if s := c.write(w.method, w.path, w.body, nil); s != http.StatusUnprocessableEntity {
			t.Errorf("%s on a paid payout: %d", w.path, s)
		}
	}
	// Another tenant's payout is not found.
	if s := c.get("/payouts/"+payoutB, &struct{}{}); s != http.StatusNotFound {
		t.Errorf("another tenant's payout: %d", s)
	}
}
