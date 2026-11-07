//go:build integration

package integration

import (
	"context"
	"net/http"
	"testing"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

// TestDocsOwnerOnly: the reference opens only to a tenant's owner signed in to the backoffice.
func TestDocsOwnerOnly(t *testing.T) {
	pool := testkit.DB(t)
	if _, err := pool.Exec(context.Background(), `UPDATE tenants SET owner_id = $1 WHERE slug = 'tenant-a'`, testkit.AdminA); err != nil {
		t.Fatal(err)
	}
	a := testkit.NewAPI(t, pool, "")
	owner := testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice"))
	ownerSeller := testkit.Session(a.SignIn(t, testkit.AdminA, "seller"))
	guest := testkit.Session(a.SignIn(t, testkit.GuestA, "backoffice"))
	for _, path := range []string{"/docs", "/openapi.yaml"} {
		for _, c := range []struct {
			name   string
			cookie *http.Cookie
			want   int
		}{
			{"the owner", owner, 200},
			{"the owner in the seller app", ownerSeller, 404},
			{"a guest", guest, 404},
			{"nobody", nil, 404},
		} {
			var cookies []*http.Cookie
			if c.cookie != nil {
				cookies = append(cookies, c.cookie)
			}
			resp := a.Request(t, http.MethodGet, path, "backoffice", cookies...)
			resp.Body.Close()
			if resp.StatusCode != c.want {
				t.Errorf("%s %s: %d, want %d", c.name, path, resp.StatusCode, c.want)
			}
		}
	}
}
