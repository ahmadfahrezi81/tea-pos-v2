//go:build integration

package integration

import (
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/danielgtaylor/huma/v2"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

// TestPermission_EveryRoute walks every route in the contract, the same list openapi.yaml is
// generated from: each must declare who may call it, and each protected one must refuse
// a caller without a session, with the wrong role and from another tenant.
func TestPermission_EveryRoute(t *testing.T) {
	api := testkit.NewAPI(t, testkit.DB(t), "")
	spec := api.Huma.OpenAPI()
	seller := api.SignIn(t, testkit.SellerA, "seller")
	admin := api.SignIn(t, testkit.AdminA, "seller")
	sellerB := api.SignIn(t, testkit.SellerB, "seller")

	checked := 0
	for path, item := range spec.Paths {
		for method, op := range map[string]*huma.Operation{
			http.MethodGet: item.Get, http.MethodPost: item.Post, http.MethodPut: item.Put,
			http.MethodPatch: item.Patch, http.MethodDelete: item.Delete,
		} {
			if op == nil {
				continue
			}
			checked++
			name := method + " " + path
			access, ok := op.Extensions["x-access"].(auth.Access)
			if !ok {
				t.Errorf("%s declares no access: register it with handler.route", name)
				continue
			}
			// A write is saved once per Idempotency-Key, or declared harmless to repeat.
			if method != http.MethodGet && !access.SavedOnce && !access.SafeToRepeat {
				t.Errorf("%s is a write without .Idempotent() or .Repeatable()", name)
			}
			if access.Public {
				continue
			}
			url := strings.ReplaceAll(path, "{tenant}", "tenant-a")
			if resp := api.Request(t, method, url, "seller"); resp.StatusCode != http.StatusUnauthorized {
				t.Errorf("%s without a session: status %d, want 401", name, resp.StatusCode)
			}
			if len(access.Roles) > 0 {
				for _, who := range []struct{ token, role string }{{seller, "USER"}, {admin, "ADMIN"}} {
					if !slices.Contains(access.Roles, who.role) {
						if resp := api.Request(t, method, url, "seller", testkit.Session(who.token)); resp.StatusCode != http.StatusForbidden {
							t.Errorf("%s as %s: status %d, want 403", name, who.role, resp.StatusCode)
						}
					}
				}
			}
			if access.Tenant {
				if resp := api.Request(t, method, url, "seller", testkit.Session(sellerB)); resp.StatusCode != http.StatusForbidden {
					t.Errorf("%s from another tenant: status %d, want 403", name, resp.StatusCode)
				}
			}
		}
	}
	if checked == 0 {
		t.Fatal("no routes found")
	}
}
