//go:build integration

package testkit

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/files"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/handler"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/middleware"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/realtime"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/version"
)

const (
	EdgeSecret = "test-edge-secret-test-edge-secret-0"
	// TestLoginKey switches on /auth/test when the tests are built with -tags testlogin.
	TestLoginKey = "test-login-key-test-login-key-test-00"
)

// Fixture user ids (tests/fixtures/base.sql).
const (
	SellerA   = "00000000-0000-0000-0001-00000000000a"
	AdminA    = "00000000-0000-0000-0002-00000000000a"
	InactiveA = "00000000-0000-0000-0003-00000000000a"
	DriverA   = "00000000-0000-0000-0004-00000000000a"
	SellerB   = "00000000-0000-0000-0001-00000000000b"
	NoTenant  = "00000000-0000-0000-0005-000000000000"
)

// API is the real API, middleware chain included, on a test server.
type API struct {
	URL      string
	Huma     huma.API
	Sessions *auth.Sessions
}

// NewAPI serves the API on pool. supabaseURL is a fake Supabase, or "" when sign-in is not under test.
func NewAPI(t *testing.T, pool *pgxpool.Pool, supabaseURL string) *API {
	t.Helper()
	return NewAPIWith(t, pool, Options{SupabaseURL: supabaseURL})
}

type Options struct {
	SupabaseURL    string
	MinAppVersions map[string]version.Release
	// Flags replaces PostHog's; nil has every flag off.
	Flags auth.Flags
	// StorageURL is a fake Supabase for photo uploads.
	StorageURL string
}

func NewAPIWith(t *testing.T, pool *pgxpool.Pool, o Options) *API {
	t.Helper()
	q := store.New(pool)
	sessions := auth.NewSessions(q)
	mux := http.NewServeMux()
	api := handler.NewAPI(mux, handler.Deps{
		DB:           pool,
		Queries:      q,
		Sessions:     sessions,
		Supabase:     auth.NewSupabase(o.SupabaseURL, "test-publishable-key"),
		Limiter:      auth.NewLimiter(10, time.Minute),
		TestLoginKey: TestLoginKey,
		Flags:        o.Flags,
		Files:        files.NewStorage(o.StorageURL, "test-secret-key"),
	})
	srv := httptest.NewServer(middleware.Standard(mux, middleware.Options{RequestTimeout: 5 * time.Second, EdgeSecret: EdgeSecret, MinAppVersions: o.MinAppVersions}))
	t.Cleanup(srv.Close)
	return &API{URL: srv.URL, Huma: api, Sessions: sessions}
}

// SignIn makes a session for a fixture user in app, as the callback would, and returns its token.
func (a *API) SignIn(t *testing.T, userID, app string) string {
	t.Helper()
	var id pgtype.UUID
	if err := id.Scan(userID); err != nil {
		t.Fatal(err)
	}
	token, err := a.Sessions.Create(context.Background(), id, app, "", "")
	if err != nil {
		t.Fatalf("sign in: %v", err)
	}
	return token
}

// Session is the cookie a signed-in phone sends.
func Session(token string) *http.Cookie { return &http.Cookie{Name: auth.CookieName, Value: token} }

// Request is a call as the forwarder makes it: edge secret, app and its address set.
func (a *API) Request(t *testing.T, method, path, app string, cookies ...*http.Cookie) *http.Response {
	t.Helper()
	return a.Send(t, method, path, app, "", nil, cookies...)
}

// Send is Request with a JSON body and headers ("Name: value" each).
func (a *API) Send(t *testing.T, method, path, app, body string, headers []string, cookies ...*http.Cookie) *http.Response {
	t.Helper()
	req, err := http.NewRequest(method, a.URL+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for _, h := range headers {
		k, v, _ := strings.Cut(h, ":")
		req.Header.Set(k, strings.TrimSpace(v))
	}
	req.Header.Set("X-Edge-Secret", EdgeSecret)
	req.Header.Set("X-App", app)
	req.Header.Set("X-App-Origin", "https://"+app+".test")
	req.Header.Set("X-Client-IP", "203.0.113.7")
	for _, c := range cookies {
		req.AddCookie(c)
	}
	resp, err := noRedirects.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { resp.Body.Close() })
	return resp
}

var noRedirects = &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error {
	return http.ErrUseLastResponse
}}

// NewRealtime serves the realtime hub on pool, listening for announcements as in production.
func NewRealtime(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	q := store.New(pool)
	hub := realtime.NewHub(auth.NewSessions(q), q)
	ctx, cancel := context.WithCancel(context.Background())
	go hub.Listen(ctx, pool.Config().ConnConfig.Copy())
	mux := http.NewServeMux()
	mux.Handle("GET /realtime", hub)
	srv := httptest.NewServer(middleware.Standard(mux, middleware.Options{RequestTimeout: 5 * time.Second, EdgeSecret: EdgeSecret}))
	t.Cleanup(func() {
		hub.CloseAll()
		cancel()
		srv.Close()
	})
	// LISTEN is set up a moment after start; announcements before it would be missed.
	time.Sleep(200 * time.Millisecond)
	return "ws" + strings.TrimPrefix(srv.URL, "http") + "/realtime"
}
