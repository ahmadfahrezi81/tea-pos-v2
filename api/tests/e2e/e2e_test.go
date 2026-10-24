//go:build e2e

// Package e2e runs against the deployed staging, through each app's /api forwarder as a phone
// would. Users come from seed.sql and sign in with the test sign-in (TEST_LOGIN_KEY).
package e2e

import (
	"encoding/json"
	"net/http"
	"net/http/cookiejar"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
)

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

var (
	seller     = env("E2E_SELLER_URL", "https://tea-pos-staging.lykostech.app")
	backoffice = env("E2E_BACKOFFICE_URL", "https://tea-office-staging.lykostech.app")
)

// phone is one app on one phone: its own cookies, like a browser.
type phone struct {
	t      *testing.T
	app    string
	client *http.Client
}

func newPhone(t *testing.T, app string) *phone {
	t.Helper()
	jar, _ := cookiejar.New(nil)
	return &phone{t: t, app: app, client: &http.Client{Jar: jar}}
}

func (p *phone) do(method, path, body string, header map[string]string) (*http.Response, map[string]any) {
	p.t.Helper()
	req, err := http.NewRequest(method, p.app+"/api"+path, strings.NewReader(body))
	if err != nil {
		p.t.Fatal(err)
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range header {
		req.Header.Set(k, v)
	}
	resp, err := p.client.Do(req)
	if err != nil {
		p.t.Fatal(err)
	}
	defer resp.Body.Close()
	var out map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return resp, out
}

func (p *phone) signIn(email string) (*http.Response, map[string]any) {
	p.t.Helper()
	key := os.Getenv("TEST_LOGIN_KEY")
	if key == "" {
		p.t.Fatal("TEST_LOGIN_KEY is not set")
	}
	return p.do(http.MethodPost, "/auth/test", `{"email":"`+email+`"}`, map[string]string{"X-Test-Key": key})
}

func (p *phone) me() contract.Me {
	p.t.Helper()
	resp, body := p.do(http.MethodGet, "/me", "", nil)
	if resp.StatusCode != http.StatusOK {
		p.t.Fatalf("/me: status %d %v", resp.StatusCode, body["code"])
	}
	raw, _ := json.Marshal(body)
	var me contract.Me
	_ = json.Unmarshal(raw, &me)
	return me
}

func mustSignIn(t *testing.T, p *phone, email string) {
	t.Helper()
	if resp, body := p.signIn(email); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("sign in as %s: status %d %v", email, resp.StatusCode, body["code"])
	}
}

func TestHealth_RunsTheCommitUnderTest(t *testing.T) {
	want := os.Getenv("E2E_COMMIT")
	for _, app := range []string{seller, backoffice} {
		resp, body := newPhone(t, app).do(http.MethodGet, "/health", "", nil)
		if resp.StatusCode != http.StatusOK || body["status"] != "ok" {
			t.Fatalf("%s /health: status %d", app, resp.StatusCode)
		}
		if want != "" && body["commit"] != want {
			t.Errorf("%s runs %v, want %s", app, body["commit"], want)
		}
		if body["version"] != "staging" {
			t.Errorf("%s says version %v, want staging", app, body["version"])
		}
	}
}

func TestMonitoring_TimingAndEventsReachThePhone(t *testing.T) {
	p := newPhone(t, seller)
	mustSignIn(t, p, "seller@test-a.test")
	resp, _ := p.do(http.MethodGet, "/me", "", nil)
	if st := resp.Header.Get("Server-Timing"); !strings.Contains(st, "db;dur=") {
		t.Errorf("Server-Timing through the forwarder: %q", st)
	}
	at := time.Now().UTC().Format(time.RFC3339)
	if resp, body := p.do(http.MethodPost, "/events", `{"session":"0192f1a2-3b4c-7d5e-8f60-718293a4b5c6","device":{},"events":[{"type":"pageview","path":"/e2e","at":"`+at+`"}]}`, nil); resp.StatusCode != http.StatusNoContent {
		t.Errorf("/events: status %d %v", resp.StatusCode, body["code"])
	}
}

func TestSignIn_SignedOutAndStrangersAreRefused(t *testing.T) {
	p := newPhone(t, seller)
	if resp, body := p.do(http.MethodGet, "/me", "", nil); resp.StatusCode != http.StatusUnauthorized || body["code"] != "not_signed_in" {
		t.Errorf("/me signed out: status %d %v", resp.StatusCode, body["code"])
	}
	if resp, _ := p.signIn("nobody@test-a.test"); resp.StatusCode != http.StatusNotFound {
		t.Errorf("unknown test user: status %d, want 404", resp.StatusCode)
	}
	if resp, _ := p.do(http.MethodPost, "/auth/test", `{"email":"seller@test-a.test"}`, map[string]string{"X-Test-Key": "wrong-wrong-wrong-wrong-wrong-wrong-00"}); resp.StatusCode != http.StatusNotFound {
		t.Errorf("wrong key: status %d, want 404", resp.StatusCode)
	}
}

func TestMe_SellerSeesOnlyTheirStore(t *testing.T) {
	p := newPhone(t, seller)
	mustSignIn(t, p, "seller@test-a.test")
	me := p.me()
	if len(me.Tenants) != 1 || me.Tenants[0].Slug != "test-a" {
		t.Fatalf("tenants: %+v", me.Tenants)
	}
	if s := me.Tenants[0].Stores; len(s) != 1 || s[0].Name != "Test A Central" || !s[0].IsDefault {
		t.Fatalf("stores: %+v", s)
	}
}

func TestMe_AdminSeesTheWholeTenantAndNoOther(t *testing.T) {
	p := newPhone(t, backoffice)
	mustSignIn(t, p, "admin@test-a.test")
	me := p.me()
	if len(me.Tenants) != 1 || me.Tenants[0].Slug != "test-a" || len(me.Tenants[0].Stores) != 2 {
		t.Fatalf("tenants: %+v", me.Tenants)
	}
	for _, s := range me.Tenants[0].Stores {
		if strings.HasPrefix(s.Name, "Test B") {
			t.Fatalf("admin of test-a sees %s", s.Name)
		}
	}
}

func TestSignIn_AppRules(t *testing.T) {
	if resp, body := newPhone(t, backoffice).signIn("seller@test-a.test"); resp.StatusCode != http.StatusForbidden || body["code"] != "not_allowed" {
		t.Errorf("seller on backoffice: status %d %v", resp.StatusCode, body["code"])
	}
	if resp, body := newPhone(t, seller).signIn("inactive@test-a.test"); resp.StatusCode != http.StatusForbidden || body["code"] != "account_inactive" {
		t.Errorf("inactive seller: status %d %v", resp.StatusCode, body["code"])
	}
}

func TestSignOut_EndsTheSession(t *testing.T) {
	p := newPhone(t, seller)
	mustSignIn(t, p, "seller@test-b.test")
	p.me()
	if resp, _ := p.do(http.MethodPost, "/auth/logout", "", nil); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("sign out: status %d", resp.StatusCode)
	}
	if resp, _ := p.do(http.MethodGet, "/me", "", nil); resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("/me after sign out: status %d, want 401", resp.StatusCode)
	}
}

// Signing out everywhere ends the user's other sessions too (017b also closes their sockets).
func TestSignOutEverywhere(t *testing.T) {
	one, two := newPhone(t, seller), newPhone(t, seller)
	mustSignIn(t, one, "seller@test-b.test")
	mustSignIn(t, two, "seller@test-b.test")
	if resp, _ := one.do(http.MethodPost, "/auth/logout-everywhere", "", nil); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("sign out everywhere: status %d", resp.StatusCode)
	}
	if resp, _ := two.do(http.MethodGet, "/me", "", nil); resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("the other phone's /me: status %d, want 401", resp.StatusCode)
	}
}

// The Store tab's numbers come through the backoffice's forwarder for the test admin, from
// seed.sql's days and orders, and a seller cannot read them.
func TestStore_AdminSeesTheTenantsSales(t *testing.T) {
	admin := newPhone(t, backoffice)
	mustSignIn(t, admin, "admin@test-a.test")
	today := time.Now().In(time.FixedZone("WIB", 7*3600)).Format(time.DateOnly)
	resp, body := admin.do(http.MethodGet, "/tenants/test-a/sales/days?from="+today[:8]+"01&to="+today, "", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("sales/days: %d %v", resp.StatusCode, body["code"])
	}
	if days, _ := body["days"].([]any); len(days) == 0 {
		t.Fatal("no days this month: is seed.sql's Store data there?")
	}
	if resp, body := admin.do(http.MethodGet, "/tenants/test-a/orders?date="+today, "", nil); resp.StatusCode != http.StatusOK {
		t.Fatalf("orders: %d %v", resp.StatusCode, body["code"])
	}
	sellerPhone := newPhone(t, seller)
	mustSignIn(t, sellerPhone, "seller@test-a.test")
	if resp, _ := sellerPhone.do(http.MethodGet, "/tenants/test-a/sales/days?from="+today+"&to="+today, "", nil); resp.StatusCode != http.StatusForbidden {
		t.Fatalf("seller: %d, want 403", resp.StatusCode)
	}
}

// The Pay tab answers the test admin through the forwarder: the period and the staff.
func TestPay_AdminSeesThePeriodAndStaff(t *testing.T) {
	admin := newPhone(t, backoffice)
	mustSignIn(t, admin, "admin@test-a.test")
	for _, path := range []string{"/tenants/test-a/pay/period", "/tenants/test-a/pay/staff", "/tenants/test-a/pay/commission-types", "/tenants/test-a/pay/claim-types"} {
		if resp, body := admin.do(http.MethodGet, path, "", nil); resp.StatusCode != http.StatusOK {
			t.Errorf("%s: %d %v", path, resp.StatusCode, body["code"])
		}
	}
}
