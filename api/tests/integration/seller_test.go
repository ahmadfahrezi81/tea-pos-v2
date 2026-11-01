//go:build integration

package integration

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

// TestSellerDay: a seller opens a store, sells, and the day's totals move with each order; a
// changed price is refused; someone else takes over only with the code.
func TestSellerDay(t *testing.T) {
	pool := testkit.DB(t)
	a := testkit.NewAPI(t, pool, "")
	seller := testkit.Session(a.SignIn(t, testkit.SellerA, "seller"))
	if _, err := pool.Exec(t.Context(), `INSERT INTO user_store_assignments (user_id, store_id) SELECT $1, $2
		WHERE NOT EXISTS (SELECT 1 FROM user_store_assignments WHERE user_id = $1 AND store_id = $2)`, testkit.SellerA, storeACentral); err != nil {
		t.Fatal(err)
	}
	var product string
	if err := pool.QueryRow(t.Context(), `INSERT INTO tenant_products (name, price, tenant_id, status) VALUES ('Tea', 5000, $1, 'active') RETURNING id::text`, tenantA).Scan(&product); err != nil {
		t.Fatal(err)
	}
	n := 0
	write := func(who *http.Cookie, path, body string) (int, []byte) {
		n++
		resp := a.Send(t, http.MethodPost, "/tenants/tenant-a/stores/"+storeACentral+path, "seller", body,
			[]string{fmt.Sprintf("Idempotency-Key: seller-%04d", n)}, who)
		defer resp.Body.Close()
		data, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, data
	}
	gate := func(who *http.Cookie) contract.StoreGate {
		var g contract.StoreGate
		decode(t, a.Request(t, http.MethodGet, "/tenants/tenant-a/stores/"+storeACentral+"/gate", "seller", who), &g)
		return g
	}

	if g := gate(seller); g.Gate != "no_day" {
		t.Fatalf("before opening: %+v", g)
	}
	order := fmt.Sprintf(`{"items":[{"productId":%q,"quantity":2,"unitPrice":5000}]}`, product)
	if s, _ := write(seller, "/orders", order); s != 409 {
		t.Errorf("selling before opening: %d", s)
	}
	if s, b := write(seller, "/open", `{"openingBalance":10000}`); s != 200 {
		t.Fatalf("open: %d %s", s, b)
	}
	g := gate(seller)
	if g.Gate != "open" || g.ClaimCode == "" || g.OpeningBalance != 10000 || g.ExpectedCash != 10000 {
		t.Fatalf("after opening: %+v", g)
	}
	if s, _ := write(seller, "/open", `{"openingBalance":1}`); s != 409 {
		t.Errorf("opening twice: %d", s)
	}
	if s, b := write(seller, "/orders", order); s != 200 {
		t.Fatalf("order: %d %s", s, b)
	}
	if g := gate(seller); g.Sales != 10000 || g.Orders != 1 || g.Cups != 2 || g.ExpectedCash != 20000 {
		t.Errorf("totals: %+v", g)
	}
	if s, _ := write(seller, "/orders", fmt.Sprintf(`{"items":[{"productId":%q,"quantity":1,"unitPrice":1}]}`, product)); s != 409 {
		t.Errorf("a wrong price: %d", s)
	}
	if g2 := gate(seller); g2.Orders != 1 {
		t.Errorf("a refused order counted: %+v", g2)
	}

	if s, b := write(seller, "/take-over", `{"claimCode":"xx"}`); s != 403 {
		t.Errorf("a wrong code: %d %s", s, b)
	}
	if s, b := write(seller, "/take-over", fmt.Sprintf(`{"claimCode":%q}`, g.ClaimCode)); s != 200 {
		t.Errorf("the right code: %d %s", s, b)
	}
}

// TestSellerCloseDay: closing counts the day from its rows, ends the session and pays out: the
// commission, the automatic claims and the payout, all at once, and only once.
func TestSellerCloseDay(t *testing.T) {
	pool := testkit.DB(t)
	a := testkit.NewAPI(t, pool, "")
	seller := testkit.Session(a.SignIn(t, testkit.SellerA, "seller"))
	ctx := t.Context()
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO user_store_assignments (user_id, store_id) SELECT $1, $2
		WHERE NOT EXISTS (SELECT 1 FROM user_store_assignments WHERE user_id = $1 AND store_id = $2)`, testkit.SellerA, storeACentral)
	var product, rate string
	if err := pool.QueryRow(ctx, `INSERT INTO tenant_products (name, price, tenant_id, status) VALUES ('Tea', 5000, $1, 'active') RETURNING id::text`, tenantA).Scan(&product); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO payroll_commission_configs (tenant_id, name, slug, rate_per_cup) VALUES ($1, 'Rate', 'SELLER_500', 500) RETURNING id::text`, tenantA).Scan(&rate); err != nil {
		t.Fatal(err)
	}
	exec(`DELETE FROM payroll_user_info WHERE user_id = $1 AND tenant_id = $2`, testkit.SellerA, tenantA)
	exec(`INSERT INTO payroll_user_info (tenant_id, user_id, commission_config_id) VALUES ($1, $2, $3)`, tenantA, testkit.SellerA, rate)
	claim := func(slug, source string, amount int, hours any) {
		t.Helper()
		exec(`WITH c AS (INSERT INTO payroll_claim_configs (tenant_id, name, slug, frequency, amount, claim_source, auto_threshold_hours)
			VALUES ($1, $2, $2, 'daily', $3, $4, $5) RETURNING id)
			INSERT INTO payroll_user_claim_assignments (tenant_id, user_id, claim_config_id) SELECT $1, $6, id FROM c`,
			tenantA, slug, amount, source, hours, testkit.SellerA)
	}
	claim("meal", "auto", 10000, 0)
	claim("long-shift", "auto", 20000, 8)
	claim("transport", "auto_submit", 5000, nil)
	claim("bonus", "auto_submit", 5000, 8)
	claim("nothing", "auto", 0, 0)
	claim("by-hand", "manual", 7000, nil)

	n := 0
	send := func(method, path, body string) (int, []byte) {
		n++
		resp := a.Send(t, method, "/tenants/tenant-a/stores/"+storeACentral+path, "seller", body,
			[]string{fmt.Sprintf("Idempotency-Key: close-%04d", n)}, seller)
		defer resp.Body.Close()
		data, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, data
	}
	must := func(method, path, body string) {
		t.Helper()
		if s, b := send(method, path, body); s >= 300 {
			t.Fatalf("%s %s: %d %s", method, path, s, b)
		}
	}
	must(http.MethodPost, "/open", `{"openingBalance":10000}`)
	var g contract.StoreGate
	decode(t, a.Request(t, http.MethodGet, "/tenants/tenant-a/stores/"+storeACentral+"/gate", "seller", seller), &g)
	day := "/days/" + g.DayID

	must(http.MethodPost, "/orders", fmt.Sprintf(`{"items":[{"productId":%q,"quantity":3,"unitPrice":5000}]}`, product))
	must(http.MethodPost, day+"/expenses", `{"type":"Ice","amount":2000}`)
	if s, _ := send(http.MethodPost, day+"/expenses", `{"type":"Ice","amount":0}`); s != 400 {
		t.Errorf("an expense of nothing: %d", s)
	}
	if s, _ := send(http.MethodPut, day+"/photos/closing:ice", `{"url":"https://elsewhere.example/x.webp"}`); s != 422 {
		t.Errorf("a photo from elsewhere: %d", s)
	}
	photo := fmt.Sprintf(`https://x.supabase.co/storage/v1/object/public/daily-photos/%s/%s/a.webp`, tenantA, storeACentral)
	must(http.MethodPut, day+"/photos/closing:cups", fmt.Sprintf(`{"url":%q,"quantity":{"value":40,"unit":"pcs"}}`, photo))
	must(http.MethodPut, day+"/photos/closing:cups", fmt.Sprintf(`{"url":%q,"quantity":{"value":41,"unit":"pcs"}}`, photo))
	var photos int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM store_daily_summary_photos WHERE daily_summary_id = $1`, g.DayID).Scan(&photos); err != nil || photos != 1 {
		t.Errorf("a slot holds one photo: %d %v", photos, err)
	}

	// A running total gone wrong: the close counts again from the rows.
	exec(`UPDATE store_daily_summaries SET total_sales = 1, expected_cash = 1 WHERE id = $1`, g.DayID)

	key := "Idempotency-Key: close-the-day"
	close := func() (int, []byte) {
		resp := a.Send(t, http.MethodPost, "/tenants/tenant-a/stores/"+storeACentral+day+"/close", "seller", `{"actualCash":22000}`, []string{key}, seller)
		defer resp.Body.Close()
		data, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, data
	}
	if s, b := close(); s != 200 {
		t.Fatalf("close: %d %s", s, b)
	}
	if s, _ := close(); s != 200 {
		t.Errorf("the same close again answers the same: %d", s)
	}
	if s, _ := send(http.MethodPost, day+"/close", `{"actualCash":1}`); s != 409 {
		t.Errorf("closing twice: %d", s)
	}
	if s, _ := send(http.MethodPost, day+"/expenses", `{"type":"Ice","amount":1}`); s != 409 {
		t.Errorf("an expense after closing: %d", s)
	}

	var sales, orders, cups, expected, actual, variance int
	var closedBy string
	if err := pool.QueryRow(ctx, `SELECT total_sales, total_orders, total_cups, expected_cash, actual_cash, variance, closed_by::text
		FROM store_daily_summaries WHERE id = $1 AND closed_at IS NOT NULL`, g.DayID).Scan(&sales, &orders, &cups, &expected, &actual, &variance, &closedBy); err != nil {
		t.Fatal(err)
	}
	if sales != 15000 || orders != 1 || cups != 3 || expected != 23000 || actual != 22000 || variance != -1000 || closedBy != testkit.SellerA {
		t.Errorf("the day: sales %d orders %d cups %d expected %d actual %d variance %d by %s", sales, orders, cups, expected, actual, variance, closedBy)
	}
	var active int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM store_sessions WHERE daily_summary_id = $1 AND status = 'active'`, g.DayID).Scan(&active); err != nil || active != 0 {
		t.Errorf("sessions left active: %d %v", active, err)
	}

	var ccups, corders int
	var total float64
	var cstatus string
	var stamped bool
	if err := pool.QueryRow(ctx, `SELECT total_cups, total_orders, total_commission::float8, status, payout_id IS NOT NULL FROM payroll_commissions WHERE daily_summary_id = $1`, g.DayID).
		Scan(&ccups, &corders, &total, &cstatus, &stamped); err != nil {
		t.Fatal(err)
	}
	if ccups != 3 || corders != 1 || total != 1500 || cstatus != "pending" || !stamped {
		t.Errorf("the commission: %d cups %d orders %v %s stamped %v", ccups, corders, total, cstatus, stamped)
	}

	rows, err := pool.Query(ctx, `SELECT cc.slug, cl.status, cl.payout_id IS NOT NULL FROM payroll_claims cl JOIN payroll_claim_configs cc ON cc.id = cl.claim_config_id WHERE cl.daily_summary_id = $1`, g.DayID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	got := map[string]string{}
	for rows.Next() {
		var slug, status string
		var ok bool
		if err := rows.Scan(&slug, &status, &ok); err != nil {
			t.Fatal(err)
		}
		if !ok {
			t.Errorf("claim %s has no payout", slug)
		}
		got[slug] = status
	}
	want := map[string]string{"meal": "approved", "long-shift": "rejected", "transport": "pending"}
	if len(got) != len(want) {
		t.Errorf("claims: %v", got)
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("claim %s: %q, want %q", k, got[k], v)
		}
	}

	// Both apps' reads, kept to the seller's own stores.
	exec(`DELETE FROM user_store_assignments WHERE user_id = $1 AND store_id = $2`, testkit.SellerA, storeANorth)
	for path, want := range map[string]int{
		"/tenants/tenant-a/days/" + g.DayID:                                               200,
		"/tenants/tenant-a/orders?from=2020-01-01&to=2020-01-02&storeId=" + storeACentral: 200,
		"/tenants/tenant-a/orders?from=2020-01-01&to=2020-01-02&storeId=" + storeANorth:   403,
		"/tenants/tenant-a/orders?from=2020-01-01&to=2020-01-02":                          403,
	} {
		if resp := a.Request(t, http.MethodGet, path, "seller", seller); resp.StatusCode != want {
			t.Errorf("%s: %d, want %d", path, resp.StatusCode, want)
		}
	}
	exec(`DELETE FROM user_store_assignments WHERE user_id = $1 AND store_id = $2`, testkit.SellerA, storeACentral)
	if resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/days/"+g.DayID, "seller", seller); resp.StatusCode != 404 {
		t.Errorf("a day of a store no longer theirs: %d", resp.StatusCode)
	}
	exec(`INSERT INTO user_store_assignments (user_id, store_id) VALUES ($1, $2)`, testkit.SellerA, storeACentral)

	if g := func() contract.StoreGate {
		var g contract.StoreGate
		decode(t, a.Request(t, http.MethodGet, "/tenants/tenant-a/stores/"+storeACentral+"/gate", "seller", seller), &g)
		return g
	}(); g.Gate != "closed" {
		t.Errorf("after closing: %+v", g)
	}
}

// TestMyClaim: a seller claims by hand once a period; the amount is the type's, and it lands in a
// payout. Only their own pay shows.
func TestMyClaim(t *testing.T) {
	pool := testkit.DB(t)
	a := testkit.NewAPI(t, pool, "")
	seller := testkit.Session(a.SignIn(t, testkit.SellerA, "seller"))
	ctx := t.Context()
	var typeID, autoID string
	if err := pool.QueryRow(ctx, `WITH c AS (INSERT INTO payroll_claim_configs (tenant_id, name, slug, frequency, amount)
		VALUES ($1, 'Parking', 'parking', 'monthly', 3000) RETURNING id)
		INSERT INTO payroll_user_claim_assignments (tenant_id, user_id, claim_config_id) SELECT $1, $2, id FROM c RETURNING claim_config_id::text`, tenantA, testkit.SellerA).Scan(&typeID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `WITH c AS (INSERT INTO payroll_claim_configs (tenant_id, name, slug, frequency, amount, claim_source, auto_threshold_hours)
		VALUES ($1, 'Meal', 'meal', 'daily', 3000, 'auto', 1) RETURNING id)
		INSERT INTO payroll_user_claim_assignments (tenant_id, user_id, claim_config_id) SELECT $1, $2, id FROM c RETURNING claim_config_id::text`, tenantA, testkit.SellerA).Scan(&autoID); err != nil {
		t.Fatal(err)
	}
	n := 0
	claim := func(body string) int {
		n++
		resp := a.Send(t, http.MethodPost, "/tenants/tenant-a/my/claims", "seller", body, []string{fmt.Sprintf("Idempotency-Key: claim-%04d", n)}, seller)
		defer resp.Body.Close()
		return resp.StatusCode
	}
	today := time.Now().In(domain.WIB).Format(time.DateOnly)
	if s := claim(fmt.Sprintf(`{"typeId":%q,"date":%q}`, autoID, today)); s != 403 {
		t.Errorf("an automatic type by hand: %d", s)
	}
	if s := claim(fmt.Sprintf(`{"typeId":%q,"date":"2020-01-01"}`, typeID)); s != 422 {
		t.Errorf("too far back: %d", s)
	}
	if s := claim(fmt.Sprintf(`{"typeId":%q,"date":%q}`, typeID, today)); s != 204 {
		t.Errorf("a claim: %d", s)
	}
	if s := claim(fmt.Sprintf(`{"typeId":%q,"date":%q}`, typeID, today)); s != 409 {
		t.Errorf("twice in a month: %d", s)
	}
	var amount float64
	var stamped bool
	if err := pool.QueryRow(ctx, `SELECT amount::float8, payout_id IS NOT NULL FROM payroll_claims WHERE user_id = $1 AND claim_config_id = $2`, testkit.SellerA, typeID).Scan(&amount, &stamped); err != nil {
		t.Fatal(err)
	}
	if amount != 3000 || !stamped {
		t.Errorf("the claim: %v stamped %v", amount, stamped)
	}
	var pay contract.MyPayOutput
	decode(t, a.Request(t, http.MethodGet, "/tenants/tenant-a/my/pay", "seller", seller), &pay.Body)
	if len(pay.Body.Payouts) != 1 || pay.Body.NextPayout == "" {
		t.Fatalf("my pay: %+v", pay.Body)
	}
	if resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/my/payouts/"+pay.Body.Payouts[0].ID, "seller", seller); resp.StatusCode != 200 {
		t.Errorf("my payslip: %d", resp.StatusCode)
	}
	other := testkit.Session(a.SignIn(t, testkit.AdminA, "seller"))
	if resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/my/payouts/"+pay.Body.Payouts[0].ID, "seller", other); resp.StatusCode != 404 {
		t.Errorf("someone else's payslip: %d", resp.StatusCode)
	}
	var types contract.MyClaimTypesOutput
	decode(t, a.Request(t, http.MethodGet, "/tenants/tenant-a/my/claim-types", "seller", seller), &types.Body)
	for _, ty := range types.Body.Types {
		if ty.ID == typeID && ty.Claimable {
			t.Errorf("no room left this month: %+v", ty)
		}
	}
}

// TestOldDayOpen: an earlier day never closed stops today opening, says why, and leaves nothing
// behind; closing the old day clears the way.
func TestOldDayOpen(t *testing.T) {
	pool := testkit.DB(t)
	a := testkit.NewAPI(t, pool, "")
	seller := testkit.Session(a.SignIn(t, testkit.SellerA, "seller"))
	ctx := t.Context()
	if _, err := pool.Exec(ctx, `INSERT INTO user_store_assignments (user_id, store_id) SELECT $1, $2
		WHERE NOT EXISTS (SELECT 1 FROM user_store_assignments WHERE user_id = $1 AND store_id = $2)`, testkit.SellerA, storeACentral); err != nil {
		t.Fatal(err)
	}
	var old string
	if err := pool.QueryRow(ctx, `INSERT INTO store_daily_summaries (store_id, tenant_id, opened_by, date) VALUES ($1, $2, $3, CURRENT_DATE - 3) RETURNING id::text`,
		storeACentral, tenantA, testkit.AdminA).Scan(&old); err != nil {
		t.Fatal(err)
	}
	// Someone else held it and went home.
	if _, err := pool.Exec(ctx, `INSERT INTO store_sessions (tenant_id, store_id, daily_summary_id, user_id, claim_code) VALUES ($1, $2, $3, $4, '11')`,
		tenantA, storeACentral, old, testkit.AdminA); err != nil {
		t.Fatal(err)
	}
	send := func(key, path, body string) (int, string) {
		resp := a.Send(t, http.MethodPost, "/tenants/tenant-a/stores/"+storeACentral+path, "seller", body, []string{"Idempotency-Key: " + key}, seller)
		defer resp.Body.Close()
		data, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, string(data)
	}
	if s, b := send("old-day-0001", "/open", `{"openingBalance":0}`); s != 409 || !strings.Contains(b, "old_day_open") {
		t.Fatalf("open with an old day: %d %s", s, b)
	}
	var days int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM store_daily_summaries WHERE store_id = $1`, storeACentral).Scan(&days); err != nil || days != 1 {
		t.Errorf("a refused open left a day: %d %v", days, err)
	}
	if s, b := send("old-day-0002", "/days/"+old+"/close", `{"actualCash":0}`); s != 200 {
		t.Fatalf("close the old day: %d %s", s, b)
	}
	if s, b := send("old-day-0003", "/open", `{"openingBalance":0}`); s != 200 {
		t.Errorf("open after: %d %s", s, b)
	}
	if s, b := send("old-day-0004", "/take-over", `{"claimCode":"xx"}`); s != 403 {
		t.Errorf("a wrong code: %d %s", s, b)
	}
	var product string
	if err := pool.QueryRow(ctx, `INSERT INTO tenant_products (name, price, tenant_id, status) VALUES ('Tea', 5000, $1, 'active') RETURNING id::text`, tenantA).Scan(&product); err != nil {
		t.Fatal(err)
	}
	order := fmt.Sprintf(`{"items":[{"productId":%q,"quantity":1,"unitPrice":5000}]}`, product)
	if s, b := send("old-day-0005", "/orders", order); s != 200 {
		t.Errorf("the holder sells: %d %s", s, b)
	}
	if _, err := pool.Exec(ctx, `UPDATE store_sessions SET user_id = $1 WHERE store_id = $2 AND status = 'active'`, testkit.AdminA, storeACentral); err != nil {
		t.Fatal(err)
	}
	if s, b := send("old-day-0006", "/orders", order); s != 409 || !strings.Contains(b, "session_taken") {
		t.Errorf("a phone left on the menu: %d %s", s, b)
	}
}

// Temporary: shows the PR's failure comment. Removed before merging.
func TestTemporaryFailure(t *testing.T) {
	t.Error("this test fails on purpose, to see the comment")
}
