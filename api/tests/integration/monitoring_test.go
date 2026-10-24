//go:build integration

package integration

import (
	"net/http"
	"regexp"
	"strconv"
	"testing"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/version"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

// flags is PostHog's flags as a test sets them.
type flags map[string]bool

func (f flags) Enabled(key, _ string, _ map[string]any) bool { return f[key] }
func (f flags) All(string, map[string]any) map[string]bool   { return f }

func TestAppTooOld(t *testing.T) {
	a := testkit.NewAPIWith(t, testkit.DB(t), testkit.Options{
		MinAppVersions: map[string]version.Release{"seller": {2026, 10, 4}},
	})
	seller := testkit.Session(a.SignIn(t, testkit.SellerA, "seller"))
	admin := testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice"))

	for _, c := range []struct {
		name, app, header string
		cookie            *http.Cookie
		want              int
	}{
		{"older release", "seller", "seller@2026.10.3+a1b2c3d", seller, http.StatusUpgradeRequired},
		{"older year", "seller", "seller@2025.12.9", seller, http.StatusUpgradeRequired},
		{"the cut-off", "seller", "seller@2026.10.4+a1b2c3d", seller, http.StatusOK},
		{"newer", "seller", "seller@2026.11.1+a1b2c3d", seller, http.StatusOK},
		{"no header", "seller", "", seller, http.StatusOK},
		{"staging build", "seller", "seller@staging+a1b2c3d", seller, http.StatusOK},
		{"malformed", "seller", "nonsense", seller, http.StatusOK},
		{"no cut-off for this app", "backoffice", "backoffice@2020.1.1", admin, http.StatusOK},
	} {
		t.Run(c.name, func(t *testing.T) {
			var headers []string
			if c.header != "" {
				headers = []string{"X-App-Version: " + c.header}
			}
			resp := a.Send(t, http.MethodGet, "/me", c.app, "", headers, c.cookie)
			if resp.StatusCode != c.want {
				t.Fatalf("status %d, want %d", resp.StatusCode, c.want)
			}
			if c.want == http.StatusUpgradeRequired {
				if got := code(t, resp); got != "app_too_old" {
					t.Fatalf("code %q", got)
				}
			}
		})
	}

	// /health is not behind the forwarder; it never refuses.
	resp, err := http.Get(a.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("/health: %d", resp.StatusCode)
	}
}

var serverTiming = regexp.MustCompile(`^db;dur=(\d+\.\d), app;dur=(\d+\.\d)$`)

func TestServerTiming(t *testing.T) {
	a := testkit.NewAPI(t, testkit.DB(t), "")
	resp := a.Request(t, http.MethodGet, "/me", "seller", testkit.Session(a.SignIn(t, testkit.SellerA, "seller")))
	m := serverTiming.FindStringSubmatch(resp.Header.Get("Server-Timing"))
	if m == nil {
		t.Fatalf("Server-Timing %q", resp.Header.Get("Server-Timing"))
	}
	db, _ := strconv.ParseFloat(m[1], 64)
	total, _ := strconv.ParseFloat(m[2], 64)
	// /me reads the session and three more; none of it is free.
	if db <= 0 || total < db {
		t.Fatalf("db %v, app %v", db, total)
	}
}

func TestMaintenance(t *testing.T) {
	a := testkit.NewAPIWith(t, testkit.DB(t), testkit.Options{Flags: flags{"ops-maintenance": true}})

	resp := a.Request(t, http.MethodGet, "/me", "seller", testkit.Session(a.SignIn(t, testkit.SellerA, "seller")))
	if resp.StatusCode != http.StatusServiceUnavailable || code(t, resp) != "maintenance" {
		t.Fatalf("seller: status %d", resp.StatusCode)
	}
	// Admins are let through, to check before reopening.
	resp = a.Request(t, http.MethodGet, "/me", "backoffice", testkit.Session(a.SignIn(t, testkit.AdminA, "backoffice")))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("admin: status %d", resp.StatusCode)
	}
	resp = a.Request(t, http.MethodGet, "/health", "seller")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("/health: status %d", resp.StatusCode)
	}
}

// storeFlags is on only at one store, as a PostHog rule on storeId.
type storeFlags struct{ store *string }

func (f storeFlags) Enabled(string, string, map[string]any) bool { return false }
func (f storeFlags) All(_ string, props map[string]any) map[string]bool {
	if props["storeId"] == *f.store && props["tenantId"] != nil && props["app"] == "seller" {
		return map[string]bool{"ops-skip-manage-photos": true}
	}
	return map[string]bool{}
}

func TestMeFlags(t *testing.T) {
	a := testkit.NewAPIWith(t, testkit.DB(t), testkit.Options{Flags: flags{"feature-qris": true}})
	if me := getMe(t, a, testkit.SellerA, "seller"); !me.Flags["feature-qris"] || len(me.Flags) != 1 {
		t.Fatalf("flags %v", me.Flags)
	}

	// A rule on one store is on at that store only, not for the user as a whole.
	var target string
	s := testkit.NewAPIWith(t, testkit.DB(t), testkit.Options{Flags: storeFlags{&target}})
	target = getMe(t, s, testkit.SellerA, "seller").Tenants[0].Stores[0].ID
	me := getMe(t, s, testkit.SellerA, "seller")
	if st := me.Tenants[0].Stores[0]; !st.Flags["ops-skip-manage-photos"] {
		t.Errorf("store %s: flags %v", st.Name, st.Flags)
	}
	if len(me.Flags) != 0 {
		t.Errorf("user flags %v", me.Flags)
	}
	// The admin's other stores do not match the rule (and backoffice is not the seller app).
	for _, st := range getMe(t, s, testkit.AdminA, "backoffice").Tenants[0].Stores {
		if st.Flags["ops-skip-manage-photos"] {
			t.Errorf("backoffice store %s: flag on", st.Name)
		}
	}
	// Without PostHog every flag is off, and the list is empty rather than missing.
	b := testkit.NewAPI(t, testkit.DB(t), "")
	if me := getMe(t, b, testkit.SellerA, "seller"); me.Flags == nil || len(me.Flags) != 0 {
		t.Fatalf("flags %v", me.Flags)
	}
}

func TestEvents(t *testing.T) {
	a := testkit.NewAPI(t, testkit.DB(t), "")
	seller := testkit.Session(a.SignIn(t, testkit.SellerA, "seller"))
	batch := `{"events":[
		{"type":"pageview","path":"/test-a/home","at":"2026-10-24T08:00:00Z"},
		{"type":"error","path":"/test-a/home","at":"2026-10-24T08:00:01Z","name":"TypeError","message":"x is undefined","stack":"at f (app.js:1:2)"}
	]}`

	if resp := a.Send(t, http.MethodPost, "/events", "seller", batch, nil, seller); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("status %d", resp.StatusCode)
	}
	if resp := a.Send(t, http.MethodPost, "/events", "seller", batch, nil); resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("signed out: status %d", resp.StatusCode)
	}
	for _, bad := range []string{
		`{"events":[]}`,
		`{"events":[{"type":"click","path":"/","at":"2026-10-24T08:00:00Z"}]}`,
	} {
		if resp := a.Send(t, http.MethodPost, "/events", "seller", bad, nil, seller); resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("%s: status %d", bad, resp.StatusCode)
		}
	}
}
