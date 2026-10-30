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
