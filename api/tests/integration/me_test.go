//go:build integration

package integration

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

func getMe(t *testing.T, a *testkit.API, userID, app string) contract.Me {
	t.Helper()
	resp := a.Request(t, http.MethodGet, "/me", app, testkit.Session(a.SignIn(t, userID, app)))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d, code %q", resp.StatusCode, code(t, resp))
	}
	var me contract.Me
	if err := json.NewDecoder(resp.Body).Decode(&me); err != nil {
		t.Fatal(err)
	}
	return me
}

func storeNames(tenant contract.MeTenant) map[string]bool {
	names := map[string]bool{}
	for _, s := range tenant.Stores {
		names[s.Name] = s.IsDefault
	}
	return names
}

func TestMeSellerSeesOnlyTheirStores(t *testing.T) {
	a := testkit.NewAPI(t, testkit.DB(t), "")
	me := getMe(t, a, testkit.SellerA, "seller")

	if me.User.ID != testkit.SellerA || me.User.FullName != "Seller A" || me.User.Role != "USER" {
		t.Fatalf("user: %+v", me.User)
	}
	if len(me.Tenants) != 1 || me.Tenants[0].Slug != "tenant-a" {
		t.Fatalf("tenants: %+v", me.Tenants)
	}
	got := storeNames(me.Tenants[0])
	want := map[string]bool{"A Central": true, "A North": false}
	if len(got) != len(want) || got["A Central"] != true || got["A North"] {
		t.Fatalf("stores: got %v, want %v", got, want)
	}
}

func TestMeBackofficeSeesEveryStoreOfTheTenant(t *testing.T) {
	a := testkit.NewAPI(t, testkit.DB(t), "")
	me := getMe(t, a, testkit.AdminA, "backoffice")

	if len(me.Tenants) != 1 || me.Tenants[0].Slug != "tenant-a" {
		t.Fatalf("tenants: %+v", me.Tenants)
	}
	got := storeNames(me.Tenants[0])
	// The closed store too; only North is the admin's own default.
	if len(got) != 3 || !got["A North"] || got["A Central"] || got["A Closed"] {
		t.Fatalf("stores: %v", got)
	}
}

func TestMeWithoutTenant(t *testing.T) {
	a := testkit.NewAPI(t, testkit.DB(t), "")
	me := getMe(t, a, testkit.NoTenant, "seller")
	if me.Tenants == nil || len(me.Tenants) != 0 {
		t.Fatalf("want an empty list, got %#v", me.Tenants)
	}
}

func TestMeSignedOut(t *testing.T) {
	a := testkit.NewAPI(t, testkit.DB(t), "")
	resp := a.Request(t, http.MethodGet, "/me", "seller")
	if resp.StatusCode != http.StatusUnauthorized || code(t, resp) != "not_signed_in" {
		t.Fatalf("status %d", resp.StatusCode)
	}
}
