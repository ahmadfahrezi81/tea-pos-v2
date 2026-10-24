//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

func TestFeedbacksAndWeather(t *testing.T) {
	pool := testkit.DB(t)
	ctx := context.Background()
	today := time.Now().In(domain.WIB).Format(time.DateOnly)
	for _, q := range []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO tenant_customer_feedbacks (tenant_id, user_id, location_name, location_display, latitude, longitude, notes, created_at) VALUES
			($1, $2, 'Jl. Raya 1', 'Ciomas', -6.6, 106.76, 'Near the school', now() - interval '1 day'),
			($1, $2, 'Jl. Raya 2', 'Bogor', -6.59, 106.8, NULL, now()),
			($3, $4, 'Elsewhere', 'Jakarta', -6.2, 106.8, NULL, now())`,
			[]any{tenantA, testkit.SellerA, "00000000-0000-0000-0000-00000000000b", testkit.SellerB}},
		{`INSERT INTO weather_hourly (date, hour, temperature, precipitation_probability, weather_code, lat, lng, city, region) VALUES
			($1, 9, 28.4, 10, 1100, -6.6, 106.76, 'Ciomas', 'Bogor'), ($1, 10, 29.6, 0, 1000, -6.6, 106.76, 'Ciomas', 'Bogor')`,
			[]any{today}},
	} {
		if _, err := pool.Exec(ctx, q.sql, q.args...); err != nil {
			t.Fatal(err)
		}
	}
	a := testkit.NewAPI(t, pool, "")
	admin := testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice"))
	var fb struct{ Feedbacks []contract.Feedback }
	decode(t, a.Request(t, http.MethodGet, "/tenants/tenant-a/feedbacks", "backoffice", admin), &fb)
	if len(fb.Feedbacks) != 2 || fb.Feedbacks[0].LocationDisplay != "Bogor" || fb.Feedbacks[1].Notes != "Near the school" || fb.Feedbacks[0].UserName != "Seller A" {
		t.Errorf("feedbacks: %+v", fb.Feedbacks)
	}
	var w contract.WeatherOutput
	decode(t, a.Request(t, http.MethodGet, "/tenants/tenant-a/weather", "backoffice", admin), &w.Body)
	if w.Body.City != "Ciomas" || len(w.Body.Hours) != 2 || w.Body.Hours[0].Temperature != 28 || w.Body.Hours[1].Temperature != 30 {
		t.Errorf("weather: %+v", w.Body)
	}
	// The weather for a seller too; feedback for admins only.
	seller := testkit.Session(a.SignIn(t, testkit.SellerA, "seller"))
	if resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/weather", "seller", seller); resp.StatusCode != 200 {
		t.Errorf("seller weather: %d", resp.StatusCode)
	}
	if resp := a.Request(t, http.MethodGet, "/tenants/tenant-a/feedbacks", "seller", seller); resp.StatusCode != http.StatusForbidden {
		t.Errorf("seller feedbacks: %d", resp.StatusCode)
	}
}

func decode(t *testing.T, resp *http.Response, out any) {
	t.Helper()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d", resp.StatusCode)
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		t.Fatal(err)
	}
}
