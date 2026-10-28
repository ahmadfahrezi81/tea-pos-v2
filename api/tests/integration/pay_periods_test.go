//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

// TestPayPeriods: the current period with each person's payout and what is still to review;
// the one before by its first day; nothing after the current one; a guest may look.
func TestPayPeriods(t *testing.T) {
	pool := testkit.DB(t)
	ctx := context.Background()
	start, end, _ := domain.PayWindow(time.Now().In(domain.WIB), "bi_weekly")
	prev, prevEnd, _ := domain.PayWindow(start.AddDate(0, 0, -1), "bi_weekly")
	d := func(t time.Time) string { return t.Format(time.DateOnly) }
	if _, err := pool.Exec(ctx, `
		INSERT INTO public.payroll_payouts (tenant_id, user_id, status, start_date, end_date) VALUES
		($1, $2, 'pending', $4, $5), ($1, $3, 'pending', $4, $5), ($1, $2, 'paid', $6, $7)`,
		tenantA, testkit.SellerA, testkit.AdminA, d(start), d(end), d(prev), d(prevEnd)); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO public.payroll_claims (tenant_id, user_id, amount, date, status, payout_id)
		SELECT tenant_id, user_id, 50000, start_date, s, id
		FROM public.payroll_payouts, (VALUES ('approved'), ('pending')) v (s)
		WHERE user_id = $1 AND status = 'pending'`, testkit.SellerA); err != nil {
		t.Fatal(err)
	}
	a := testkit.NewAPI(t, pool, "")
	guest := testkit.Session(a.SignIn(t, testkit.GuestA, "backoffice"))
	get := func(at string) (int, contract.PayPeriodAt) {
		resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/pay/periods/"+at, "backoffice", guest)
		var p contract.PayPeriodAt
		_ = json.NewDecoder(resp.Body).Decode(&p)
		return resp.StatusCode, p
	}

	s, p := get("current")
	if s != 200 || p.Start != d(start) || p.Previous != d(prev) || p.Next != "" || len(p.People) != 2 {
		t.Fatalf("current: %d %+v", s, p)
	}
	if p.Owed != 50000 || p.ToReview != 1 {
		t.Errorf("owed %d, to review %d; want 50000 and 1", p.Owed, p.ToReview)
	}
	if s, p = get(d(prev)); s != 200 || len(p.People) != 1 || p.People[0].Status != "paid" || p.Next != d(start) || p.Owed != 0 {
		t.Errorf("previous: %d %+v", s, p)
	}
	if s, _ = get(d(end.AddDate(0, 0, 1))); s != 404 {
		t.Errorf("after the current period: %d, want 404", s)
	}
}
