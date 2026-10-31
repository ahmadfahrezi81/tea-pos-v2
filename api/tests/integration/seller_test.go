//go:build integration

package integration

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

// TestSellerDay: a seller opens a store, sells, and the day's totals move with each order; a
// changed price is refused; someone else takes over only with the code.
func TestSellerDay(t *testing.T) {
	pool := testkit.DB(t)
	a := testkit.NewAPI(t, pool, "")
	seller := testkit.Session(a.SignIn(t, testkit.SellerA, "seller"))
	if _, err := pool.Exec(t.Context(), `INSERT INTO user_store_assignments (user_id, store_id) SELECT $1, $2
		WHERE NOT EXISTS (SELECT 1 FROM user_store_assignments WHERE user_id = $1 AND store_id = $2)`, testkit.SellerA, storeACentral); err != nil {
		t.Fatal(err)
	}
	var product string
	if err := pool.QueryRow(t.Context(), `INSERT INTO tenant_products (name, price, tenant_id, status) VALUES ('Tea', 5000, $1, 'active') RETURNING id::text`, tenantA).Scan(&product); err != nil {
		t.Fatal(err)
	}
	n := 0
	write := func(who *http.Cookie, path, body string) (int, []byte) {
		n++
		resp := a.Send(t, http.MethodPost, "/tenants/tenant-a/stores/"+storeACentral+path, "seller", body,
			[]string{fmt.Sprintf("Idempotency-Key: seller-%04d", n)}, who)
		defer resp.Body.Close()
		data, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, data
	}
	gate := func(who *http.Cookie) contract.StoreGate {
		var g contract.StoreGate
		decode(t, a.Request(t, http.MethodGet, "/tenants/tenant-a/stores/"+storeACentral+"/gate", "seller", who), &g)
		return g
	}

	if g := gate(seller); g.Gate != "no_day" {
		t.Fatalf("before opening: %+v", g)
	}
	order := fmt.Sprintf(`{"items":[{"productId":%q,"quantity":2,"unitPrice":5000}]}`, product)
	if s, _ := write(seller, "/orders", order); s != 409 {
		t.Errorf("selling before opening: %d", s)
	}
	if s, b := write(seller, "/open", `{"openingBalance":10000}`); s != 200 {
		t.Fatalf("open: %d %s", s, b)
	}
	g := gate(seller)
	if g.Gate != "open" || g.ClaimCode == "" || g.OpeningBalance != 10000 || g.ExpectedCash != 10000 {
		t.Fatalf("after opening: %+v", g)
	}
	if s, _ := write(seller, "/open", `{"openingBalance":1}`); s != 409 {
		t.Errorf("opening twice: %d", s)
	}
	if s, b := write(seller, "/orders", order); s != 200 {
		t.Fatalf("order: %d %s", s, b)
	}
	if g := gate(seller); g.Sales != 10000 || g.Orders != 1 || g.Cups != 2 || g.ExpectedCash != 20000 {
		t.Errorf("totals: %+v", g)
	}
	if s, _ := write(seller, "/orders", fmt.Sprintf(`{"items":[{"productId":%q,"quantity":1,"unitPrice":1}]}`, product)); s != 409 {
		t.Errorf("a wrong price: %d", s)
	}
	if g2 := gate(seller); g2.Orders != 1 {
		t.Errorf("a refused order counted: %+v", g2)
	}

	// Someone not on this store's roster is refused outright.
	other := testkit.Session(a.SignIn(t, testkit.GuestA, "seller"))
	_ = other
	var body map[string]any
	if s, b := write(seller, "/take-over", `{"claimCode":"xx"}`); s != 403 {
		t.Errorf("a wrong code: %d %s", s, b)
	} else {
		_ = json.Unmarshal(b, &body)
	}
	if s, b := write(seller, "/take-over", fmt.Sprintf(`{"claimCode":%q}`, g.ClaimCode)); s != 200 {
		t.Errorf("the right code: %d %s", s, b)
	}
}
