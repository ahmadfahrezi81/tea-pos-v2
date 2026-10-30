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

func TestMeLanguage(t *testing.T) {
	a := testkit.NewAPI(t, testkit.DB(t), "")
	seller := testkit.Session(a.SignIn(t, testkit.SellerA, "seller"))
	if resp := a.Send(t, http.MethodPatch, "/me", "seller", `{"language":"id"}`, nil, seller); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("set: %d", resp.StatusCode)
	}
	if me := getMe(t, a, testkit.SellerA, "seller"); me.User.Language != "id" {
		t.Fatalf("language %q", me.User.Language)
	}
	// Only the caller's own profile, only a language the apps have.
	if me := getMe(t, a, testkit.SellerB, "seller"); me.User.Language == "id" {
		t.Fatal("another user's language changed")
	}
	if resp := a.Send(t, http.MethodPatch, "/me", "seller", `{"language":"fr"}`, nil, seller); resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("unknown language: %d", resp.StatusCode)
	}
	// Name and phone: only what is sent changes; a blank name is refused; an empty phone clears it.
	if resp := a.Send(t, http.MethodPatch, "/me", "seller", `{"fullName":"  New Name ","phone":"0812"}`, nil, seller); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("set name: %d", resp.StatusCode)
	}
	if me := getMe(t, a, testkit.SellerA, "seller"); me.User.FullName != "New Name" || me.User.Phone != "0812" || me.User.Language != "id" {
		t.Fatalf("after name: %+v", me.User)
	}
	if resp := a.Send(t, http.MethodPatch, "/me", "seller", `{"fullName":"  "}`, nil, seller); resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("blank name: %d", resp.StatusCode)
	}
	if resp := a.Send(t, http.MethodPatch, "/me", "seller", `{"phone":""}`, nil, seller); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("clear phone: %d", resp.StatusCode)
	}
	if me := getMe(t, a, testkit.SellerA, "seller"); me.User.Phone != "" || me.User.FullName != "New Name" {
		t.Fatalf("after clearing: %+v", me.User)
	}
}

// Each tenant says the user's level in each app: from their rows, from users.role when they have
// none (people v1 adds), and an inactive membership leaves the tenant out.
func TestMeLevelsPerApp(t *testing.T) {
	a := testkit.NewAPI(t, testkit.DB(t), "")
	cases := []struct {
		name, user, app string
		want            contract.MeAccess
	}{
		{"a guest with rows", testkit.GuestA, "backoffice", contract.MeAccess{Seller: "member", Backoffice: "guest"}},
		{"an admin from users.role", testkit.AdminA, "backoffice", contract.MeAccess{Seller: "member", Backoffice: "admin"}},
		{"a seller from users.role", testkit.SellerA, "seller", contract.MeAccess{Seller: "member"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			me := getMe(t, a, tc.user, tc.app)
			if len(me.Tenants) != 1 || me.Tenants[0].Access != tc.want || me.Tenants[0].Owner {
				t.Fatalf("tenants: %+v, want access %+v", me.Tenants, tc.want)
			}
		})
	}
	if me := getMe(t, a, testkit.OffA, "seller"); len(me.Tenants) != 0 {
		t.Errorf("turned off: tenants %+v, want none", me.Tenants)
	}
}
