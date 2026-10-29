//go:build integration

package integration

import (
	"net/http"
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
	admin := api.SignIn(t, testkit.AdminA, "seller")
	sellerB := api.SignIn(t, testkit.SellerB, "seller")
	guest := api.SignIn(t, testkit.GuestA, "backoffice")

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
			// A route for one app refuses the other app's sessions; one for admins refuses a guest.
			if access.App != "" {
				if resp := api.Request(t, method, url, "seller", testkit.Session(admin)); resp.StatusCode != http.StatusForbidden {
					t.Errorf("%s from the seller app: status %d, want 403", name, resp.StatusCode)
				}
				if access.Level == auth.Admin {
					if resp := api.Request(t, method, url, "backoffice", testkit.Session(guest)); resp.StatusCode != http.StatusForbidden {
						t.Errorf("%s as a backoffice guest: status %d, want 403", name, resp.StatusCode)
					}
				}
			}
			// Every write in the backoffice is for its admins.
			if access.App == "backoffice" && method != http.MethodGet && access.Level != auth.Admin {
				t.Errorf("%s is a backoffice write open to %q: want auth.Admin", name, access.Level)
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
