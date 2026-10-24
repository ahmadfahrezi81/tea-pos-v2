//go:build integration

package integration

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

func TestSettlePayout(t *testing.T) {
	pool := testkit.DB(t)
	ctx := context.Background()
	future := time.Now().AddDate(0, 0, 10).Format(time.DateOnly)
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	// A finished period with one approved claim; one with a claim still pending; one not over yet.
	exec(`INSERT INTO payroll_payouts (id, tenant_id, user_id, start_date, end_date) VALUES
		('00000000-0000-0000-9b01-00000000000a', $1, $2, '2026-09-28', '2026-10-11'),
		('00000000-0000-0000-9b02-00000000000a', $1, $3, '2026-09-28', '2026-10-11'),
		('00000000-0000-0000-9b03-00000000000a', $1, $2, '2026-10-12', $4)`,
		tenantA, testkit.SellerA, "00000000-0000-0000-0004-00000000000a", future)
	exec(`INSERT INTO payroll_claims (tenant_id, user_id, amount, date, status, payout_id) VALUES
		($1, $2, 15000, '2026-10-01', 'approved', '00000000-0000-0000-9b01-00000000000a'),
		($1, $3, 5000, '2026-10-01', 'pending', '00000000-0000-0000-9b02-00000000000a')`,
		tenantA, testkit.SellerA, "00000000-0000-0000-0004-00000000000a")

	a := testkit.NewAPI(t, pool, "")
	c := &payClient{t: t, a: a, admin: testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice"))}
	proof := `"paymentProofUrl":"https://supabase.test/storage/v1/object/public/payroll-proofs/` + tenantA + `/1-abc.webp"`
	settle := func(id, body string) int {
		return c.write(http.MethodPost, "/payouts/"+id+"/settle", body, nil)
	}

	for name, w := range map[string]struct {
		id, body string
		want     int
	}{
		"paid without a screenshot": {"9b01", `{"status":"paid"}`, http.StatusBadRequest},
		"another tenant's proof":    {"9b01", `{"status":"paid","paymentProofUrl":"https://supabase.test/storage/v1/object/public/payroll-proofs/00000000-0000-0000-0000-00000000000b/x.webp"}`, http.StatusBadRequest},
		"a claim still pending":     {"9b02", `{"status":"skipped"}`, http.StatusUnprocessableEntity},
		"a period not over":         {"9b03", `{"status":"skipped"}`, http.StatusUnprocessableEntity},
	} {
		if s := settle("00000000-0000-0000-"+w.id+"-00000000000a", w.body); s != w.want {
			t.Errorf("%s: %d, want %d", name, s, w.want)
		}
	}
	if s := settle("00000000-0000-0000-9b01-00000000000a", `{"status":"paid",`+proof+`,"notes":"Thanks!"}`); s != 204 {
		t.Fatalf("pay: %d", s)
	}
	var status, notes, by string
	if err := pool.QueryRow(ctx, `SELECT status, notes, paid_by::text FROM payroll_payouts WHERE id = '00000000-0000-0000-9b01-00000000000a'`).Scan(&status, &notes, &by); err != nil {
		t.Fatal(err)
	}
	if status != "paid" || notes != "Thanks!" || by != testkit.AdminA {
		t.Errorf("paid payout: %s %q %s", status, notes, by)
	}
	// Settling again (another key, a stale tab) is refused: who paid it and the proof stay.
	if s := settle("00000000-0000-0000-9b01-00000000000a", `{"status":"skipped"}`); s != http.StatusUnprocessableEntity {
		t.Errorf("settled twice: %d", s)
	}
	if n := count(t, pool, `SELECT count(*) FROM tenant_activity_logs WHERE type = 'payroll_payout_updated'`); n != 1 {
		t.Errorf("activity: %d", n)
	}
}
