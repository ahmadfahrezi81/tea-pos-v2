//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

// TestUac: everyone with their levels; one PUT sets levels, stores and status together, writes
// users.role for v1, keeps the owner and refuses levels an app does not offer; a guest only looks.
func TestUac(t *testing.T) {
	pool := testkit.DB(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `UPDATE tenants SET owner_id = $1 WHERE slug = 'tenant-a'`, testkit.AdminA); err != nil {
		t.Fatal(err)
	}
	a := testkit.NewAPI(t, pool, "")
	admin := testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice"))
	guest := testkit.Session(a.SignIn(t, testkit.GuestA, "backoffice"))
	n := 0
	put := func(who *http.Cookie, user, body string) (int, string) {
		n++
		resp := a.Send(t, http.MethodPut, "/tenants/tenant-a/uac/people/"+user, "backoffice", body,
			[]string{fmt.Sprintf("Idempotency-Key: uac-test-%04d", n)}, who)
		return resp.StatusCode, code(t, resp)
	}

	resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/uac", "backoffice", guest)
	var uac contract.UacOutput
	_ = json.NewDecoder(resp.Body).Decode(&uac.Body)
	if resp.StatusCode != 200 || len(uac.Body.People) != 7 {
		t.Fatalf("list: %d, %d people", resp.StatusCode, len(uac.Body.People))
	}
	for _, p := range uac.Body.People {
		if p.ID == testkit.AdminA && (!p.Owner || p.Access.Backoffice != "admin") {
			t.Errorf("owner: %+v", p)
		}
		if p.ID == testkit.OffA && p.Active {
			t.Errorf("turned off shows active: %+v", p)
		}
	}

	// Seller A becomes a backoffice guest at North only.
	body := fmt.Sprintf(`{"access":{"seller":"member","backoffice":"guest"},"storeIds":[%q],"active":true}`, storeANorth)
	if s, c := put(guest, testkit.SellerA, body); s != 403 {
		t.Errorf("a guest saving: %d %s", s, c)
	}
	if s, c := put(admin, testkit.SellerA, body); s != 200 {
		t.Fatalf("save: %d %s", s, c)
	}
	var role string
	var stores int
	_ = pool.QueryRow(ctx, `SELECT role, (SELECT count(*) FROM user_store_assignments WHERE user_id = $1) FROM users WHERE id = $1`, testkit.SellerA).Scan(&role, &stores)
	if role != "USER" || stores != 1 {
		t.Errorf("after: role %s, %d stores; want USER, 1", role, stores)
	}
	// Admin in the backoffice: v1 sees ADMIN.
	if s, _ := put(admin, testkit.SellerA, `{"access":{"seller":"member","backoffice":"admin"},"storeIds":[],"active":true}`); s != 200 {
		t.Fatal(s)
	}
	_ = pool.QueryRow(ctx, `SELECT role FROM users WHERE id = $1`, testkit.SellerA).Scan(&role)
	if role != "ADMIN" {
		t.Errorf("role %s, want ADMIN", role)
	}
	// Turned off: no stores (v1 shows nothing), out of the tenant at once.
	seller := testkit.Session(a.SignIn(t, testkit.SellerA, "seller"))
	if s, _ := put(admin, testkit.SellerA, fmt.Sprintf(`{"access":{"seller":"member","backoffice":""},"storeIds":[%q],"active":false}`, storeANorth)); s != 200 {
		t.Fatal(s)
	}
	_ = pool.QueryRow(ctx, `SELECT role, (SELECT count(*) FROM user_store_assignments WHERE user_id = $1) FROM users WHERE id = $1`, testkit.SellerA).Scan(&role, &stores)
	if role != "USER" || stores != 0 {
		t.Errorf("off: role %s, %d stores; want USER, 0", role, stores)
	}
	if r := a.Request(t, http.MethodGet, "/tenants/tenant-a/weather", "seller", seller); r.StatusCode != 403 {
		t.Errorf("turned off, next request: %d", r.StatusCode)
	}
	// v1's seller app reads users.status, and turning back on restores it.
	var status string
	_ = pool.QueryRow(ctx, `SELECT status FROM users WHERE id = $1`, testkit.SellerA).Scan(&status)
	if status != "inactive" {
		t.Errorf("off: users.status %s", status)
	}
	if s, _ := put(admin, testkit.SellerA, fmt.Sprintf(`{"access":{"seller":"member","backoffice":""},"storeIds":[%q],"active":true}`, storeANorth)); s != 200 {
		t.Fatal(s)
	}
	_ = pool.QueryRow(ctx, `SELECT status FROM users WHERE id = $1`, testkit.SellerA).Scan(&status)
	if status != "active" {
		t.Errorf("back on: users.status %s", status)
	}

	for _, tc := range []struct{ name, user, body, code string }{
		{"the owner lowered", testkit.AdminA, `{"access":{"seller":"member","backoffice":"guest"},"storeIds":[],"active":true}`, "owner_kept"},
		{"a level the app lacks", testkit.GuestA, `{"access":{"seller":"admin","backoffice":"guest"},"storeIds":[],"active":true}`, "bad_level"},
		{"another tenant's store", testkit.GuestA, `{"access":{"seller":"member","backoffice":""},"storeIds":["00000000-0000-0000-0010-00000000000b"],"active":true}`, "store_not_found"},
		{"someone in no tenant of ours", testkit.SellerB, `{"access":{"seller":"member","backoffice":""},"storeIds":[],"active":true}`, "person_not_found"},
	} {
		if s, c := put(admin, tc.user, tc.body); c != tc.code {
			t.Errorf("%s: %d %s, want %s", tc.name, s, c, tc.code)
		}
	}
}

// TestUacOffAndNone: off clears levels and stores and stays None when turned back on; None
// everywhere does not fall back to users.role; an admin changes a name and phone, and a guest cannot.
func TestUacOffAndNone(t *testing.T) {
	pool := testkit.DB(t)
	ctx := context.Background()
	a := testkit.NewAPI(t, pool, "")
	admin := testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice"))
	guest := testkit.Session(a.SignIn(t, testkit.GuestA, "backoffice"))
	n := 0
	send := func(who *http.Cookie, path, body string) (int, string) {
		n++
		resp := a.Send(t, http.MethodPut, "/tenants/tenant-a/uac/people/"+testkit.SellerA+path, "backoffice", body,
			[]string{fmt.Sprintf("Idempotency-Key: uac-off-%04d", n)}, who)
		return resp.StatusCode, code(t, resp)
	}
	get := func() contract.UacPerson {
		var p contract.UacPerson
		resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/uac/people/"+testkit.SellerA, "backoffice", admin)
		_ = json.NewDecoder(resp.Body).Decode(&p)
		return p
	}

	body := fmt.Sprintf(`{"access":{"seller":"member","backoffice":""},"storeIds":[%q],"active":false}`, storeANorth)
	if s, c := send(admin, "", body); s != 200 {
		t.Fatalf("off: %d %s", s, c)
	}
	if p := get(); p.Active || p.Access.Seller != "" || p.Access.Backoffice != "" || len(p.StoreIDs) != 0 {
		t.Errorf("off keeps access: %+v", p)
	}
	if s, c := send(admin, "", `{"access":{"seller":"","backoffice":""},"storeIds":[],"active":true}`); s != 200 {
		t.Fatalf("on: %d %s", s, c)
	}
	if p := get(); !p.Active || p.Access.Seller != "" || p.Access.Backoffice != "" {
		t.Errorf("None fell back to the role: %+v", p)
	}

	if s, c := send(guest, "/details", `{"fullName":"X","phone":""}`); s != 403 {
		t.Errorf("a guest renaming: %d %s", s, c)
	}
	if s, c := send(admin, "/details", `{"fullName":"  ","phone":""}`); s != 400 || c != "blank_name" {
		t.Errorf("blank name: %d %s", s, c)
	}
	if s, c := send(admin, "/details", `{"fullName":" New Name ","phone":" 0812 "}`); s != 200 {
		t.Fatalf("details: %d %s", s, c)
	}
	if p := get(); p.Name != "New Name" || p.Phone != "0812" {
		t.Errorf("details: %+v", p)
	}

	// Claims per person: exactly the listed enabled types; a disabled one stays; another tenant's refused.
	var on, off string
	seed := `INSERT INTO payroll_claim_configs (tenant_id, name, slug, frequency, amount, claim_source, is_enabled)
		SELECT id, $1, $1, 'daily', 1000, 'manual', $2 FROM tenants WHERE slug = 'tenant-a' RETURNING id::text`
	if err := pool.QueryRow(ctx, seed, "on-type", true).Scan(&on); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, seed, "off-type", false).Scan(&off); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO payroll_user_claim_assignments (tenant_id, user_id, claim_config_id)
		SELECT id, $1, $2 FROM tenants WHERE slug = 'tenant-a'`, testkit.SellerA, off); err != nil {
		t.Fatal(err)
	}
	claims := func(body string) (int, string) {
		n++
		resp := a.Send(t, http.MethodPut, "/tenants/tenant-a/pay/staff/"+testkit.SellerA+"/claim-types", "backoffice", body,
			[]string{fmt.Sprintf("Idempotency-Key: uac-off-%04d", n)}, admin)
		return resp.StatusCode, code(t, resp)
	}
	if s, c := claims(fmt.Sprintf(`{"claimTypeIds":[%q]}`, on)); s >= 300 {
		t.Fatalf("claims: %d %s", s, c)
	}
	if p := get(); len(p.ClaimTypeIDs) != 1 || p.ClaimTypeIDs[0] != on {
		t.Errorf("claims shown: %+v", p.ClaimTypeIDs)
	}
	var kept int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM payroll_user_claim_assignments WHERE user_id = $1 AND claim_config_id = $2`, testkit.SellerA, off).Scan(&kept)
	if kept != 1 {
		t.Errorf("a disabled claim type was dropped")
	}
	if s, c := claims(`{"claimTypeIds":["00000000-0000-0000-0000-000000000099"]}`); s != 404 {
		t.Errorf("unknown claim type: %d %s", s, c)
	}
}

// TestUacOwnerStores: the owner picks their own stores, sending back the levels the page shows them;
// another admin cannot change them.
func TestUacOwnerStores(t *testing.T) {
	pool := testkit.DB(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `UPDATE tenants SET owner_id = $1 WHERE slug = 'tenant-a'`, testkit.AdminA); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO user_app_access (tenant_id, user_id, app, access)
		SELECT id, $1, 'backoffice', 'admin' FROM tenants WHERE slug = 'tenant-a'
		ON CONFLICT (tenant_id, user_id, app) DO UPDATE SET access = 'admin'`, testkit.SellerA); err != nil {
		t.Fatal(err)
	}
	a := testkit.NewAPI(t, pool, "")
	owner := testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice"))
	other := testkit.Session(a.SignIn(t, testkit.SellerA, "backoffice"))
	put := func(who *http.Cookie, key, stores string) (int, string) {
		resp := a.Send(t, http.MethodPut, "/tenants/tenant-a/uac/people/"+testkit.AdminA, "backoffice",
			`{"access":{"seller":"admin","backoffice":"admin"},"storeIds":[`+stores+`],"active":true}`,
			[]string{"Idempotency-Key: owner-stores-" + key}, who)
		return resp.StatusCode, code(t, resp)
	}
	if s, c := put(owner, "1", fmt.Sprintf("%q", storeANorth)); s != 200 {
		t.Fatalf("the owner's stores: %d %s", s, c)
	}
	var seller string
	if err := pool.QueryRow(ctx, `SELECT access FROM user_app_access WHERE user_id = $1 AND app = 'seller'`, testkit.AdminA).Scan(&seller); err != nil || seller != "member" {
		t.Errorf("seller level stored: %q %v", seller, err)
	}
	if s, c := put(other, "2", ""); s != 422 || c != "owner_kept" {
		t.Errorf("another admin changing them: %d %s", s, c)
	}
}
