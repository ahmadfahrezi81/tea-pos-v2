//go:build integration

package integration

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

// TestStoreSettings: an admin adds, changes and deletes a store; one with history is kept; the
// values are checked; a guest reads but changes nothing.
func TestStoreSettings(t *testing.T) {
	pool := testkit.DB(t)
	daySummaries(t, pool)
	a := testkit.NewAPI(t, pool, "")
	admin := testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice"))
	guest := testkit.Session(a.SignIn(t, testkit.GuestA, "backoffice"))
	n := 0
	send := func(who *http.Cookie, method, path, body string) (int, string, contract.StoreSettings) {
		n++
		resp := a.Send(t, method, "/tenants/tenant-a/store-settings"+path, "backoffice", body,
			[]string{fmt.Sprintf("Idempotency-Key: store-settings-%04d", n)}, who)
		defer resp.Body.Close()
		var out struct {
			contract.StoreSettings
			Code string
		}
		_ = json.NewDecoder(resp.Body).Decode(&out)
		return resp.StatusCode, out.Code, out.StoreSettings
	}
	store := `{"name":" Pop-up ","address":"","status":"fake","openTime":"09:00","closeTime":"17:00","latitude":-6.2,"longitude":106.8}`

	if s, _, _ := send(guest, http.MethodPost, "", store); s != 403 {
		t.Errorf("a guest adding: %d", s)
	}
	s, c, made := send(admin, http.MethodPost, "", store)
	if s != 200 || made.Name != "Pop-up" || made.Status != "fake" || made.Latitude == nil || *made.Latitude != -6.2 {
		t.Fatalf("add: %d %s %+v", s, c, made)
	}
	if s, c, _ := send(admin, http.MethodPut, "/"+made.ID, `{"name":"Pop-up","address":"","status":"active","openTime":"18:00","closeTime":"09:00"}`); s != 422 || c != "bad_hours" {
		t.Errorf("closing before opening: %d %s", s, c)
	}
	if s, c, _ := send(admin, http.MethodPut, "/"+made.ID, `{"name":"Pop-up","address":"","status":"active","openTime":"09:00","closeTime":"17:00","latitude":91}`); s != 400 || c != "bad_request" {
		t.Errorf("latitude 91: %d %s", s, c)
	}
	s, c, changed := send(admin, http.MethodPut, "/"+made.ID, `{"name":"Pop-up 2","address":"Jl. Baru","status":"inactive","openTime":"09:00","closeTime":"17:00"}`)
	if s != 200 || changed.Name != "Pop-up 2" || changed.Status != "inactive" || changed.Latitude != nil {
		t.Errorf("change: %d %s %+v", s, c, changed)
	}
	if s, c, _ := send(admin, http.MethodDelete, "/"+storeANorth, ""); s != 409 || c != "store_has_history" {
		t.Errorf("deleting a store with days: %d %s", s, c)
	}
	if s, c, _ := send(admin, http.MethodDelete, "/"+made.ID, ""); s != 204 {
		t.Errorf("deleting the new store: %d %s", s, c)
	}
	if s, c, _ := send(admin, http.MethodGet, "/"+made.ID, ""); s != 404 || c != "store_not_found" {
		t.Errorf("after delete: %d %s", s, c)
	}
	resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/store-settings", "backoffice", guest)
	defer resp.Body.Close()
	var list struct{ Stores []contract.StoreSettings }
	_ = json.NewDecoder(resp.Body).Decode(&list)
	if resp.StatusCode != 200 || len(list.Stores) == 0 || list.Stores[0].Status != "active" {
		t.Errorf("a guest reading: %d %+v", resp.StatusCode, list.Stores)
	}
}
