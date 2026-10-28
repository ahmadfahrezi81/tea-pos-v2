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

// TestAccessRequests: someone new signs in to an empty account, reaches nothing, asks tenant A;
// an admin lets them in with seller access, or turns them down, and a block drops later asks.
func TestAccessRequests(t *testing.T) {
	pool := testkit.DB(t)
	ctx := context.Background()
	const (
		newcomer = "00000000-0000-0000-0009-00000000000a"
		stranger = "00000000-0000-0000-0009-00000000000b"
	)
	for _, id := range []string{newcomer, stranger} {
		for _, sql := range []string{
			`INSERT INTO auth.users (id, email) VALUES ($1::uuid, $1::text || '@new.test')`,
			`INSERT INTO users (id, email, full_name, role, status) VALUES ($1::uuid, $1::text || '@new.test', 'New', 'USER', 'pending')`,
		} {
			if _, err := pool.Exec(ctx, sql, id); err != nil {
				t.Fatal(err)
			}
		}
	}
	a := testkit.NewAPI(t, pool, "")
	admin := testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice"))
	newSeller := testkit.Session(a.SignIn(t, newcomer, "seller"))
	newBackoffice := testkit.Session(a.SignIn(t, newcomer, "backoffice"))
	strangerS := testkit.Session(a.SignIn(t, stranger, "seller"))
	n := 0
	send := func(who *http.Cookie, method, path, app, body string) (int, string) {
		n++
		resp := a.Send(t, method, path, app, body, []string{fmt.Sprintf("Idempotency-Key: ask-test-%04d", n)}, who)
		return resp.StatusCode, code(t, resp)
	}
	me := func(who *http.Cookie, app string) contract.Me {
		resp := a.Request(t, http.MethodGet, "/me", app, who)
		var m contract.Me
		_ = json.NewDecoder(resp.Body).Decode(&m)
		if resp.StatusCode != 200 {
			t.Fatalf("/me: %d", resp.StatusCode)
		}
		return m
	}
	pending := func() []contract.AccessRequest {
		resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/uac", "backoffice", admin)
		var out contract.UacOutput
		_ = json.NewDecoder(resp.Body).Decode(&out.Body)
		return out.Body.Requests
	}

	// Signed in, but in nothing: /me answers, every tenant route refuses.
	if m := me(newSeller, "seller"); len(m.Tenants) != 0 || len(m.Asked) != 0 {
		t.Fatalf("empty account: %+v", m)
	}
	if s, _ := send(newSeller, http.MethodGet, "/tenants/tenant-a/weather", "seller", ""); s != 403 {
		t.Errorf("a newcomer on a tenant route: %d", s)
	}

	// Asking twice makes one request; a slug that is no tenant answers the same.
	for range 2 {
		if s, c := send(newBackoffice, http.MethodPost, "/access-requests", "backoffice", `{"tenant":"tenant-a"}`); s != 204 {
			t.Fatalf("ask: %d %s", s, c)
		}
	}
	if s, _ := send(newBackoffice, http.MethodPost, "/access-requests", "backoffice", `{"tenant":"nowhere"}`); s != 204 {
		t.Errorf("unknown tenant: %d", s)
	}
	if m := me(newBackoffice, "backoffice"); len(m.Asked) != 1 || m.Asked[0] != "tenant-a" {
		t.Errorf("asked: %v", m.Asked)
	}
	reqs := pending()
	if len(reqs) != 1 || reqs[0].UserID != newcomer {
		t.Fatalf("requests: %+v", reqs)
	}

	// Let in as a seller: a member, active, in v1 too.
	body := `{"access":{"seller":"member","backoffice":""},"storeIds":[],"active":true}`
	if s, c := send(admin, http.MethodPost, "/tenants/tenant-a/uac/requests/"+reqs[0].ID+"/approve", "backoffice", body); s != 200 {
		t.Fatalf("approve: %d %s", s, c)
	}
	if s, c := send(admin, http.MethodPost, "/tenants/tenant-a/uac/requests/"+reqs[0].ID+"/approve", "backoffice", body); s != 404 || c != "request_not_found" {
		t.Errorf("approve twice: %d %s", s, c)
	}
	var status string
	_ = pool.QueryRow(ctx, `SELECT status FROM users WHERE id = $1`, newcomer).Scan(&status)
	if status != "active" {
		t.Errorf("status %q, want active", status)
	}
	if m := me(newSeller, "seller"); len(m.Tenants) != 1 || m.Tenants[0].Access.Seller != "member" || len(m.Asked) != 0 {
		t.Errorf("after approve: %+v", m)
	}
	if s, c := send(newSeller, http.MethodGet, "/me", "seller", ""); s == 403 {
		t.Errorf("a new member still refused: %s", c)
	}
	if s, c := send(newSeller, http.MethodGet, "/tenants/tenant-a/weather", "seller", ""); s == 403 {
		t.Errorf("a new member still refused on a tenant route: %s", c)
	}

	// Blocked: the stranger's next ask is dropped quietly.
	if s, _ := send(strangerS, http.MethodPost, "/access-requests", "seller", `{"tenant":"tenant-a"}`); s != 204 {
		t.Fatal("stranger ask")
	}
	reqs = pending()
	if len(reqs) != 1 {
		t.Fatalf("stranger's request: %+v", reqs)
	}
	if s, c := send(admin, http.MethodPost, "/tenants/tenant-a/uac/requests/"+reqs[0].ID+"/reject", "backoffice", `{"block":true}`); s != 204 {
		t.Fatalf("block: %d %s", s, c)
	}
	if s, _ := send(strangerS, http.MethodPost, "/access-requests", "seller", `{"tenant":"tenant-a"}`); s != 204 {
		t.Errorf("blocked ask: %d", s)
	}
	if reqs = pending(); len(reqs) != 0 {
		t.Errorf("a blocked ask came through: %+v", reqs)
	}
}
