//go:build integration

package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

const tenantA = "00000000-0000-0000-0000-00000000000a"

func TestUploadAddresses(t *testing.T) {
	var signed []string
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("apikey") != "test-secret-key" || !strings.HasPrefix(r.URL.Path, "/storage/v1/object/upload/sign/") {
			http.Error(w, "no", http.StatusUnauthorized)
			return
		}
		signed = append(signed, strings.TrimPrefix(r.URL.Path, "/storage/v1/object/upload/sign/"))
		_ = json.NewEncoder(w).Encode(map[string]string{"url": strings.TrimPrefix(r.URL.Path, "/storage/v1") + "?token=t"})
	}))
	t.Cleanup(fake.Close)
	a := testkit.NewAPIWith(t, testkit.DB(t), testkit.Options{StorageURL: fake.URL})
	seller := testkit.Session(a.SignIn(t, testkit.SellerA, "seller"))
	admin := testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice"))

	upload := func(app string, who *http.Cookie, body string) (int, map[string]string) {
		resp := a.Send(t, http.MethodPost, "/tenants/tenant-a/files", app, body, nil, who)
		var out map[string]string
		_ = json.NewDecoder(resp.Body).Decode(&out)
		return resp.StatusCode, out
	}

	// A store's report: kept under the tenant and the store, named by Go; its row address in the old app's form.
	status, out := upload("seller", seller, `{"purpose":"report","contentType":"image/webp","size":300000,"storeId":"`+storeACentral+`"}`)
	if status != http.StatusOK {
		t.Fatalf("report: %d %v", status, out)
	}
	if !strings.HasPrefix(out["path"], tenantA+"/"+storeACentral+"/") || !strings.HasSuffix(out["path"], ".webp") {
		t.Errorf("path %q", out["path"])
	}
	if !strings.HasPrefix(out["uploadUrl"], fake.URL+"/storage/v1/object/upload/sign/store-reports/") ||
		out["url"] != fake.URL+"/storage/v1/object/public/store-reports/"+out["path"] {
		t.Errorf("addresses: %v", out)
	}
	if status, out := upload("seller", seller, `{"purpose":"daily_photo","contentType":"image/jpeg","size":300000,"storeId":"`+storeACentral+`"}`); status != http.StatusOK || !strings.HasSuffix(out["path"], ".jpg") {
		t.Errorf("daily photo: %d %v", status, out)
	}

	for _, c := range []struct {
		name, app string
		who       *http.Cookie
		body      string
		want      int
	}{
		{"another tenant's store", "seller", seller, `{"purpose":"report","contentType":"image/webp","size":1,"storeId":"` + storeBCentral + `"}`, http.StatusNotFound},
		{"a store photo without its store", "seller", seller, `{"purpose":"daily_photo","contentType":"image/webp","size":1}`, http.StatusBadRequest},
		{"a seller uploading a product image", "seller", seller, `{"purpose":"product_image","contentType":"image/webp","size":1}`, http.StatusForbidden},
		{"too big", "seller", seller, `{"purpose":"reimbursement","contentType":"image/webp","size":1048577}`, http.StatusBadRequest},
		{"not a photo", "seller", seller, `{"purpose":"reimbursement","contentType":"image/png","size":1}`, http.StatusBadRequest},
		{"an admin's product image", "backoffice", admin, `{"purpose":"product_image","contentType":"image/webp","size":1}`, http.StatusOK},
	} {
		if status, out := upload(c.app, c.who, c.body); status != c.want {
			t.Errorf("%s: %d, want %d (%v)", c.name, status, c.want, out)
		}
	}
	if resp := a.Send(t, http.MethodPost, "/tenants/tenant-b/files", "seller", `{"purpose":"reimbursement","contentType":"image/webp","size":1}`, nil, seller); resp.StatusCode != http.StatusForbidden {
		t.Errorf("another tenant: %d", resp.StatusCode)
	}
	for _, p := range signed {
		if strings.Contains(p, "..") || strings.Contains(p, " ") {
			t.Errorf("signed path %q", p)
		}
	}
}
