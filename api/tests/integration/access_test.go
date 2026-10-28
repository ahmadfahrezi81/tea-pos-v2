//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

type okOutput struct{ Body struct{ OK bool } }

// testRoutes adds routes no screen has yet, so every access rule is exercised now.
func testRoutes(api huma.API) {
	ok := func(context.Context, *struct {
		Tenant string `path:"tenant"`
	}) (*okOutput, error) {
		return &okOutput{}, nil
	}
	admin := huma.Operation{OperationID: "testAdmin", Method: http.MethodGet, Path: "/test/tenants/{tenant}/admin"}
	auth.Declare(&admin, auth.App("backoffice", auth.Admin))
	huma.Register(api, admin, ok)
	guest := huma.Operation{OperationID: "testGuest", Method: http.MethodGet, Path: "/test/tenants/{tenant}/guest"}
	auth.Declare(&guest, auth.App("backoffice", auth.Guest))
	huma.Register(api, guest, ok)
	member := huma.Operation{OperationID: "testMember", Method: http.MethodGet, Path: "/test/tenants/{tenant}/member"}
	auth.Declare(&member, auth.SignedIn.InTenant())
	huma.Register(api, member, ok)
}

func code(t *testing.T, resp *http.Response) string {
	t.Helper()
	var body struct{ Code string }
	_ = json.NewDecoder(resp.Body).Decode(&body)
	return body.Code
}

func TestAccess_SessionAppRoleTenant(t *testing.T) {
	pool := testkit.DB(t)
	api := testkit.NewAPI(t, pool, "")
	testRoutes(api.Huma)

	seller := api.SignIn(t, testkit.SellerA, "seller")
	admin := api.SignIn(t, testkit.AdminA, "seller")
	adminBackoffice := api.SignIn(t, testkit.AdminA, "backoffice")
	inactive := api.SignIn(t, testkit.InactiveA, "seller")
	driver := api.SignIn(t, testkit.DriverA, "seller")
	sellerB := api.SignIn(t, testkit.SellerB, "seller")
	guest := api.SignIn(t, testkit.GuestA, "backoffice")
	guestSeller := api.SignIn(t, testkit.GuestA, "seller")
	sellerBackoffice := api.SignIn(t, testkit.SellerA, "backoffice")
	off := api.SignIn(t, testkit.OffA, "seller")

	cases := []struct {
		name, path, app, token string
		status                 int
		code                   string
	}{
		{"no session", "/test/tenants/tenant-a/member", "seller", "", 401, "not_signed_in"},
		{"a made-up token", "/test/tenants/tenant-a/member", "seller", "not-a-real-token", 401, "not_signed_in"},
		{"a member of the tenant", "/test/tenants/tenant-a/member", "seller", seller, 200, ""},
		{"another tenant's member", "/test/tenants/tenant-a/member", "seller", sellerB, 403, "not_in_tenant"},
		{"a tenant that does not exist", "/test/tenants/nowhere/member", "seller", seller, 403, "not_in_tenant"},
		{"a seller on a backoffice route", "/test/tenants/tenant-a/admin", "seller", seller, 403, "not_allowed"},
		{"an admin's seller session on a backoffice route", "/test/tenants/tenant-a/admin", "seller", admin, 403, "not_allowed"},
		{"an admin in seller", "/test/tenants/tenant-a/member", "seller", admin, 200, ""},
		{"a backoffice guest reads", "/test/tenants/tenant-a/guest", "backoffice", guest, 200, ""},
		{"a backoffice guest cannot manage", "/test/tenants/tenant-a/admin", "backoffice", guest, 403, "not_allowed"},
		{"a backoffice guest sells (its own level there)", "/test/tenants/tenant-a/member", "seller", guestSeller, 200, ""},
		{"a seller has no backoffice level", "/test/tenants/tenant-a/guest", "backoffice", sellerBackoffice, 403, "not_allowed"},
		{"turned off in the tenant", "/test/tenants/tenant-a/member", "seller", off, 403, "not_in_tenant"},
		{"an admin reads as a guest would", "/test/tenants/tenant-a/guest", "backoffice", adminBackoffice, 200, ""},
		{"an inactive seller", "/test/tenants/tenant-a/member", "seller", inactive, 403, "not_allowed"},
		{"a role the app does not let in", "/test/tenants/tenant-a/member", "seller", driver, 403, "not_allowed"},
		{"a seller session sent to backoffice", "/test/tenants/tenant-a/member", "backoffice", seller, 403, "not_allowed"},
		{"a backoffice session in backoffice", "/test/tenants/tenant-a/admin", "backoffice", adminBackoffice, 200, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var cookies []*http.Cookie
			if tc.token != "" {
				cookies = append(cookies, testkit.Session(tc.token))
			}
			resp := api.Request(t, http.MethodGet, tc.path, tc.app, cookies...)
			if resp.StatusCode != tc.status {
				t.Fatalf("status %d, want %d", resp.StatusCode, tc.status)
			}
			if tc.code != "" {
				if got := code(t, resp); got != tc.code {
					t.Errorf("code %q, want %q", got, tc.code)
				}
			}
		})
	}
}

// The owner never loses access: a level row saying guest still makes them an admin.
func TestAccess_OwnerIsAlwaysAdmin(t *testing.T) {
	pool := testkit.DB(t)
	api := testkit.NewAPI(t, pool, "")
	testRoutes(api.Huma)
	guest := api.SignIn(t, testkit.GuestA, "backoffice")
	if resp := api.Request(t, http.MethodGet, "/test/tenants/tenant-a/admin", "backoffice", testkit.Session(guest)); resp.StatusCode != 403 {
		t.Fatalf("before: status %d, want 403", resp.StatusCode)
	}
	if _, err := pool.Exec(context.Background(), "UPDATE tenants SET owner_id = $1 WHERE slug = 'tenant-a'", testkit.GuestA); err != nil {
		t.Fatal(err)
	}
	if resp := api.Request(t, http.MethodGet, "/test/tenants/tenant-a/admin", "backoffice", testkit.Session(guest)); resp.StatusCode != 200 {
		t.Errorf("as the owner: status %d, want 200", resp.StatusCode)
	}
}

func TestAccess_RevokedSessionIsRefused(t *testing.T) {
	pool := testkit.DB(t)
	api := testkit.NewAPI(t, pool, "")
	token := api.SignIn(t, testkit.SellerA, "seller")
	if _, err := pool.Exec(context.Background(), "DELETE FROM sessions"); err != nil {
		t.Fatal(err)
	}
	// A fresh process has no cached copy; a running one stops accepting it within a minute.
	fresh := testkit.NewAPI(t, pool, "")
	if resp := fresh.Request(t, http.MethodPost, "/auth/logout", "seller", testkit.Session(token)); resp.StatusCode != 401 {
		t.Errorf("revoked session: status %d, want 401", resp.StatusCode)
	}
}

func TestAccess_SessionInUseIsRenewed(t *testing.T) {
	pool := testkit.DB(t)
	api := testkit.NewAPI(t, pool, "")
	testRoutes(api.Huma)
	token := api.SignIn(t, testkit.SellerA, "seller")
	_, err := pool.Exec(context.Background(),
		"UPDATE sessions SET last_seen_at = now() - interval '2 days', expires_at = now() + interval '1 day'")
	if err != nil {
		t.Fatal(err)
	}

	resp := api.Request(t, http.MethodGet, "/test/tenants/tenant-a/member", "seller", testkit.Session(token))
	if resp.StatusCode != 200 {
		t.Fatalf("status %d", resp.StatusCode)
	}
	if c := cookie(resp, "session"); c == nil || c.MaxAge < 29*24*60*60 {
		t.Errorf("cookie not renewed: %+v", c)
	}
	var days float64
	_ = pool.QueryRow(context.Background(), "SELECT extract(epoch FROM expires_at - now()) / 86400 FROM sessions").Scan(&days)
	if days < 29 {
		t.Errorf("session expires in %.1f days, want about 30", days)
	}
}
