//go:build integration

package integration

import (
	"context"
	"encoding/json"
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

// payClient is the admin's backoffice, sending each write with its own key (or the one given).
type payClient struct {
	t     *testing.T
	a     *testkit.API
	admin *http.Cookie
	n     int
}

func (c *payClient) get(path string, out any) int {
	c.t.Helper()
	resp := c.a.Request(c.t, http.MethodGet, "/tenants/tenant-a/pay"+path, "backoffice", c.admin)
	_ = json.NewDecoder(resp.Body).Decode(out)
	return resp.StatusCode
}

func (c *payClient) write(method, path, body string, out any, key ...string) int {
	c.t.Helper()
	c.n++
	k := fmt.Sprintf("pay-test-%04d", c.n)
	if len(key) > 0 {
		k = key[0]
	}
	resp := c.a.Send(c.t, method, "/tenants/tenant-a/pay"+path, "backoffice", body, []string{"Idempotency-Key: " + k}, c.admin)
	b, _ := io.ReadAll(resp.Body)
	if out != nil {
		_ = json.Unmarshal(b, out)
	}
	if resp.StatusCode >= 400 {
		c.t.Logf("%s %s: %d %s", method, path, resp.StatusCode, b)
	}
	return resp.StatusCode
}

func TestPaySetup(t *testing.T) {
	pool := testkit.DB(t)
	a := testkit.NewAPI(t, pool, "")
	c := &payClient{t: t, a: a, admin: testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice"))}

	// A commission type, made once even when sent twice, then re-rated and switched off.
	var standard contract.CommissionType
	if s := c.write(http.MethodPost, "/commission-types", `{"name":"Standard","slug":"SELLER_STD","ratePerCup":1000}`, &standard, "same-key-1"); s != 200 {
		t.Fatalf("create: %d", s)
	}
	c.write(http.MethodPost, "/commission-types", `{"name":"Standard","slug":"SELLER_STD","ratePerCup":1000}`, nil, "same-key-1")
	var types struct{ Types []contract.CommissionType }
	if c.get("/commission-types", &types); len(types.Types) != 1 || types.Types[0].RatePerCup != 1000 {
		t.Fatalf("types: %+v", types.Types)
	}
	if s := c.write(http.MethodPost, "/commission-types", `{"name":"Bad","slug":"lower case","ratePerCup":1}`, nil); s != http.StatusBadRequest {
		t.Errorf("a bad slug: %d", s)
	}
	var updated contract.CommissionType
	c.write(http.MethodPatch, "/commission-types/"+standard.ID, `{"ratePerCup":1200}`, &updated)
	if updated.RatePerCup != 1200 || updated.Name != "Standard" || !updated.Enabled {
		t.Errorf("updated: %+v", updated)
	}

	// Given to a seller, and the staff list shows it beside their (absent) bank details.
	if s := c.write(http.MethodPut, "/staff/"+testkit.SellerA+"/commission-type", `{"commissionTypeId":"`+standard.ID+`"}`, nil); s != 204 {
		t.Fatalf("assign: %d", s)
	}
	var staff struct{ Staff []contract.PayStaff }
	c.get("/staff", &staff)
	found := false
	for _, s := range staff.Staff {
		if s.ID == testkit.SellerA {
			found = s.CommissionType != nil && s.CommissionType.RatePerCup == 1200 && s.Name == "Seller A"
		}
		if s.ID == testkit.SellerB {
			t.Error("another tenant's seller is listed")
		}
	}
	if !found {
		t.Errorf("staff: %+v", staff.Staff)
	}
	// Refused: a user of another tenant, a switched-off type; and none is allowed.
	if s := c.write(http.MethodPut, "/staff/"+testkit.SellerB+"/commission-type", `{"commissionTypeId":null}`, nil); s != http.StatusNotFound {
		t.Errorf("another tenant's user: %d", s)
	}
	c.write(http.MethodPatch, "/commission-types/"+standard.ID, `{"enabled":false}`, nil)
	if s := c.write(http.MethodPut, "/staff/"+testkit.SellerA+"/commission-type", `{"commissionTypeId":"`+standard.ID+`"}`, nil); s != http.StatusNotFound {
		t.Errorf("a switched-off type: %d", s)
	}
	if s := c.write(http.MethodPut, "/staff/"+testkit.SellerA+"/commission-type", `{"commissionTypeId":null}`, nil); s != 204 {
		t.Errorf("none: %d", s)
	}

	// Claim types: auto needs its hours; eligibility is the set sent, whole.
	if s := c.write(http.MethodPost, "/claim-types", `{"name":"Meal","slug":"MEAL","frequency":"daily","amount":15000,"source":"auto"}`, nil); s != http.StatusBadRequest {
		t.Errorf("auto without hours: %d", s)
	}
	var meal contract.ClaimType
	if s := c.write(http.MethodPost, "/claim-types", `{"name":"Meal","slug":"MEAL","frequency":"daily","amount":15000,"source":"auto","autoThresholdHours":4}`, &meal); s != 200 || meal.AutoThresholdHours == nil || *meal.AutoThresholdHours != 4 {
		t.Fatalf("auto claim type: %d %+v", s, meal)
	}
	var eligible struct{ UserIDs []string }
	c.write(http.MethodPut, "/claim-types/"+meal.ID+"/eligible", `{"userIds":["`+testkit.SellerA+`","`+testkit.AdminA+`"]}`, nil)
	c.write(http.MethodPut, "/claim-types/"+meal.ID+"/eligible", `{"userIds":["`+testkit.SellerA+`"]}`, nil)
	if c.get("/claim-types/"+meal.ID+"/eligible", &eligible); len(eligible.UserIDs) != 1 || eligible.UserIDs[0] != testkit.SellerA {
		t.Errorf("eligible: %v", eligible.UserIDs)
	}
	if s := c.write(http.MethodPut, "/claim-types/"+meal.ID+"/eligible", `{"userIds":["`+testkit.SellerB+`"]}`, nil); s != http.StatusNotFound {
		t.Errorf("another tenant's user eligible: %d", s)
	}
	var renamed contract.ClaimType
	if c.write(http.MethodPatch, "/claim-types/"+meal.ID, `{"name":"Lunch","enabled":false}`, &renamed); renamed.Name != "Lunch" || renamed.Enabled || renamed.Amount != 15000 {
		t.Errorf("renamed: %+v", renamed)
	}

	// The schedule, and the period it gives.
	if s := c.write(http.MethodPut, "/schedule", `{"frequency":"weekly"}`, nil); s != 204 {
		t.Fatalf("schedule: %d", s)
	}
	var period contract.PayPeriod
	c.get("/period", &period)
	start, end, _ := domain.PayWindow(time.Now().In(domain.WIB), "weekly")
	if period.Frequency != "weekly" || period.Start != start.Format(time.DateOnly) || period.End != end.Format(time.DateOnly) || period.Payouts != 0 {
		t.Errorf("period: %+v", period)
	}

	// A seller may read none of it.
	seller := testkit.Session(a.SignIn(t, testkit.SellerA, "seller"))
	if resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/pay/period", "seller", seller); resp.StatusCode != http.StatusForbidden {
		t.Errorf("seller: %d", resp.StatusCode)
	}
}

// The Pay tab's totals: the selling staff's approved commissions and claims this period, the
// approved and pending counts; a non-seller's payout is left out of the money, as the old app.
func TestPayPeriodTotals(t *testing.T) {
	pool := testkit.DB(t)
	ctx := context.Background()
	start, end, _ := domain.PayWindow(time.Now().In(domain.WIB), "bi_weekly")
	s, e := start.Format(time.DateOnly), end.Format(time.DateOnly)
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`INSERT INTO payroll_commission_configs (id, tenant_id, name, slug, rate_per_cup) VALUES
		('00000000-0000-0000-c001-00000000000a', $1, 'Std', 'SELLER_STD', 1000),
		('00000000-0000-0000-c000-00000000000a', $1, 'Family', 'SELLER_0', 0)`, tenantA)
	exec(`INSERT INTO payroll_user_info (tenant_id, user_id, commission_config_id) VALUES
		($1, $2, '00000000-0000-0000-c001-00000000000a'), ($1, $3, '00000000-0000-0000-c000-00000000000a')`,
		tenantA, testkit.SellerA, "00000000-0000-0000-0004-00000000000a")
	exec(`INSERT INTO payroll_payouts (id, tenant_id, user_id, start_date, end_date) VALUES
		('00000000-0000-0000-9001-00000000000a', $1, $2, $4, $5), ('00000000-0000-0000-9002-00000000000a', $1, $3, $4, $5)`,
		tenantA, testkit.SellerA, "00000000-0000-0000-0004-00000000000a", s, e)
	exec(`INSERT INTO store_daily_summaries (id, store_id, tenant_id, opened_by, date) VALUES
		('00000000-0000-0000-0d09-00000000000a', $1, $2, $3, $4), ('00000000-0000-0000-0d08-00000000000a', $1, $2, $3, $5)`,
		storeACentral, tenantA, testkit.SellerA, s, e)
	exec(`INSERT INTO payroll_commissions (tenant_id, store_id, user_id, daily_summary_id, date, total_cups, rate_per_cup, total_commission, status, payout_id) VALUES
		($1, $2, $3, '00000000-0000-0000-0d09-00000000000a', $5, 50, 1000, 50000, 'approved', '00000000-0000-0000-9001-00000000000a'),
		($1, $2, $3, '00000000-0000-0000-0d08-00000000000a', $5, 20, 1000, 20000, 'pending', '00000000-0000-0000-9001-00000000000a'),
		($1, $2, $4, '00000000-0000-0000-0d09-00000000000a', $5, 0, 0, 0, 'approved', '00000000-0000-0000-9002-00000000000a')`,
		tenantA, storeACentral, testkit.SellerA, "00000000-0000-0000-0004-00000000000a", s)
	exec(`INSERT INTO payroll_claims (tenant_id, user_id, amount, date, status, payout_id) VALUES
		($1, $2, 15000, $3, 'approved', '00000000-0000-0000-9001-00000000000a'),
		($1, $2, 9000, $3, 'rejected', '00000000-0000-0000-9001-00000000000a')`, tenantA, testkit.SellerA, s)

	a := testkit.NewAPI(t, pool, "")
	c := &payClient{t: t, a: a, admin: testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice"))}
	var p contract.PayPeriod
	if code := c.get("/period", &p); code != 200 {
		t.Fatalf("period: %d", code)
	}
	if p.Frequency != "bi_weekly" || p.Commissions != 50000 || p.Claims != 15000 || p.Total != 65000 || p.Approved != 2 || p.Reviewed != 3 || p.Payouts != 2 {
		t.Errorf("totals: %+v", p)
	}
	if !strings.HasPrefix(p.PayoutDate, end.AddDate(0, 0, 1).Format("2006-01")) {
		t.Errorf("payout date: %s", p.PayoutDate)
	}
}
