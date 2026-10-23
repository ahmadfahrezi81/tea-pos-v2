//go:build integration && testlogin

package integration

import (
	"net/http"
	"strings"
	"testing"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

func testSignIn(t *testing.T, a *testkit.API, key, email, app string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, a.URL+"/auth/test", strings.NewReader(`{"email":"`+email+`"}`))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Test-Key", key)
	req.Header.Set("X-Edge-Secret", testkit.EdgeSecret)
	req.Header.Set("X-App", app)
	req.Header.Set("X-App-Origin", "https://"+app+".test")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { resp.Body.Close() })
	return resp
}

func sessionFrom(resp *http.Response) *http.Cookie {
	for _, c := range resp.Cookies() {
		if c.Name == auth.CookieName && c.Value != "" {
			return c
		}
	}
	return nil
}

func TestTestSignIn_SignsInATestUser(t *testing.T) {
	a := testkit.NewAPI(t, testkit.DB(t), "")
	resp := testSignIn(t, a, testkit.TestLoginKey, "seller@test-f.test", "seller")
	cookie := sessionFrom(resp)
	if resp.StatusCode != http.StatusNoContent || cookie == nil {
		t.Fatalf("status %d, cookie %v", resp.StatusCode, cookie)
	}
	if me := a.Request(t, http.MethodGet, "/me", "seller", cookie); me.StatusCode != http.StatusOK {
		t.Fatalf("/me with the test session: status %d", me.StatusCode)
	}
}

func TestTestSignIn_RefusesAnyoneElse(t *testing.T) {
	a := testkit.NewAPI(t, testkit.DB(t), "")
	for name, c := range map[string]struct{ key, email string }{
		"wrong key":                {"not-the-key-not-the-key-not-the-key", "seller@test-f.test"},
		"no key":                   {"", "seller@test-f.test"},
		"a real tenant's user":     {testkit.TestLoginKey, "seller@a.test"},
		"in a test and a real one": {testkit.TestLoginKey, "mixed@test-f.test"},
		"nobody":                   {testkit.TestLoginKey, "nobody@test-f.test"},
	} {
		resp := testSignIn(t, a, c.key, c.email, "seller")
		if resp.StatusCode != http.StatusNotFound || sessionFrom(resp) != nil {
			t.Errorf("%s: status %d, want 404 and no session", name, resp.StatusCode)
		}
	}
}

func TestTestSignIn_KeepsTheAppRules(t *testing.T) {
	a := testkit.NewAPI(t, testkit.DB(t), "")
	// A seller (USER) is not let into backoffice, as with Google.
	resp := testSignIn(t, a, testkit.TestLoginKey, "seller@test-f.test", "backoffice")
	if resp.StatusCode != http.StatusForbidden || code(t, resp) != "not_allowed" || sessionFrom(resp) != nil {
		t.Fatalf("status %d", resp.StatusCode)
	}
}
