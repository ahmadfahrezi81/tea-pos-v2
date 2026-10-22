//go:build integration

package integration

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

// fakeSupabase answers the PKCE token exchange for userID, checking the verifier against the challenge.
func fakeSupabase(t *testing.T, userID string) *httptest.Server {
	t.Helper()
	var mu sync.Mutex
	challenges := map[string]bool{}
	mux := http.NewServeMux()
	mux.HandleFunc("/auth/v1/authorize", func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		challenges[r.URL.Query().Get("code_challenge")] = true
		mu.Unlock()
	})
	mux.HandleFunc("/auth/v1/token", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			AuthCode     string `json:"auth_code"`
			CodeVerifier string `json:"code_verifier"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		sum := sha256.Sum256([]byte(body.CodeVerifier))
		mu.Lock()
		known := challenges[base64.RawURLEncoding.EncodeToString(sum[:])]
		mu.Unlock()
		if r.Header.Get("apikey") == "" || body.AuthCode != "good-code" || !known {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"user": map[string]any{
			"id": userID, "email": "x@test", "user_metadata": map[string]any{"avatar_url": "https://img.test/a.png"},
		}})
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func cookie(resp *http.Response, name string) *http.Cookie {
	for _, c := range resp.Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

// signInThroughGoogle walks /auth/google, Supabase's authorize page and /auth/callback, as a browser would.
func signInThroughGoogle(t *testing.T, api *testkit.API, app, code string) *http.Response {
	t.Helper()
	start := api.Request(t, http.MethodGet, "/auth/google", app)
	if start.StatusCode != http.StatusFound {
		t.Fatalf("start: status %d", start.StatusCode)
	}
	authorize, _ := url.Parse(start.Header.Get("Location"))
	if got := authorize.Query().Get("redirect_to"); got != "https://"+app+".test/api/auth/callback" {
		t.Fatalf("redirect_to = %q", got)
	}
	// The browser visits Supabase, which records the challenge.
	resp, err := http.Get(authorize.String())
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	pkce := cookie(start, "tea_pkce")
	if pkce == nil || !pkce.HttpOnly {
		t.Fatalf("pkce cookie: %+v", pkce)
	}
	return api.Request(t, http.MethodGet, "/auth/callback?code="+code, app, pkce)
}

func TestSignIn_GoogleToSessionToSignOut(t *testing.T) {
	pool := testkit.DB(t)
	api := testkit.NewAPI(t, pool, fakeSupabase(t, testkit.SellerA).URL)

	done := signInThroughGoogle(t, api, "seller", "good-code")
	if done.StatusCode != http.StatusFound || done.Header.Get("Location") != "/" {
		t.Fatalf("callback: %d to %q", done.StatusCode, done.Header.Get("Location"))
	}
	session := cookie(done, "session")
	if session == nil || !session.HttpOnly || !session.Secure || session.SameSite != http.SameSiteLaxMode {
		t.Fatalf("session cookie: %+v", session)
	}
	if c := cookie(done, "tea_pkce"); c == nil || c.MaxAge >= 0 {
		t.Errorf("pkce cookie not cleared: %+v", c)
	}

	var avatar string
	_ = pool.QueryRow(context.Background(), "SELECT avatar_url FROM users WHERE id = $1", testkit.SellerA).Scan(&avatar)
	if avatar != "https://img.test/a.png" {
		t.Errorf("avatar = %q", avatar)
	}

	out := api.Request(t, http.MethodPost, "/auth/logout", "seller", testkit.Session(session.Value))
	if out.StatusCode != http.StatusNoContent {
		t.Fatalf("logout: status %d", out.StatusCode)
	}
	if c := cookie(out, "session"); c == nil || c.MaxAge >= 0 {
		t.Errorf("session cookie not cleared: %+v", c)
	}
	if again := api.Request(t, http.MethodPost, "/auth/logout", "seller", testkit.Session(session.Value)); again.StatusCode != http.StatusUnauthorized {
		t.Errorf("after logout: status %d, want 401", again.StatusCode)
	}
}

func TestSignIn_Refusals(t *testing.T) {
	pool := testkit.DB(t)
	cases := []struct {
		name, user, app, code, want string
	}{
		{"a seller in backoffice", testkit.SellerA, "backoffice", "good-code", "not_allowed"},
		{"an inactive seller", testkit.InactiveA, "seller", "good-code", "account_inactive"},
		{"a driver in seller", testkit.DriverA, "seller", "good-code", "not_allowed"},
		{"a Google account with no tea-pos user", "00000000-0000-0000-0009-000000000009", "seller", "good-code", "not_allowed"},
		{"a code Supabase rejects", testkit.SellerA, "seller", "bad-code", "sign_in_failed"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			api := testkit.NewAPI(t, pool, fakeSupabase(t, tc.user).URL)
			resp := signInThroughGoogle(t, api, tc.app, tc.code)
			if got := resp.Header.Get("Location"); got != "/login?error="+tc.want {
				t.Errorf("Location = %q, want error %s", got, tc.want)
			}
			if cookie(resp, "session") != nil {
				t.Error("refused, yet a session cookie was set")
			}
		})
	}
}

func TestSignIn_RateLimitedPerIP(t *testing.T) {
	api := testkit.NewAPI(t, testkit.DB(t), fakeSupabase(t, testkit.SellerA).URL)
	for i := 1; i <= 10; i++ {
		if resp := api.Request(t, http.MethodGet, "/auth/google", "seller"); resp.StatusCode != http.StatusFound {
			t.Fatalf("call %d: status %d", i, resp.StatusCode)
		}
	}
	resp := api.Request(t, http.MethodGet, "/auth/google", "seller")
	if resp.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("11th call: status %d, want 429", resp.StatusCode)
	}
	var body struct{ Code string }
	_ = json.NewDecoder(resp.Body).Decode(&body)
	if body.Code != "too_many_requests" {
		t.Errorf("code = %q", body.Code)
	}
}

func TestSignIn_WithoutTheForwarderIsRefused(t *testing.T) {
	api := testkit.NewAPI(t, testkit.DB(t), "")
	req, _ := http.NewRequest(http.MethodGet, api.URL+"/auth/google", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound || strings.Contains(resp.Header.Get("Location"), "supabase") {
		t.Errorf("no edge secret: status %d, want 404", resp.StatusCode)
	}
}
