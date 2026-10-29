//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/coder/websocket"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/realtime"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

const (
	storeACentral = "00000000-0000-0000-0010-00000000000a"
	storeBCentral = "00000000-0000-0000-0010-00000000000b"
)

// dial opens a socket as the forwarder would, with the app's session cookie.
func dial(t *testing.T, url, app, token string) (*websocket.Conn, *http.Response, error) {
	t.Helper()
	h := http.Header{}
	h.Set("X-Edge-Secret", testkit.EdgeSecret)
	h.Set("X-App", app)
	h.Set("X-App-Origin", "https://"+app+".test")
	h.Set("Origin", "https://"+app+".test")
	if token != "" {
		h.Set("Cookie", testkit.Session(token).String())
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	c, resp, err := websocket.Dial(ctx, url, &websocket.DialOptions{HTTPHeader: h})
	if c != nil {
		t.Cleanup(func() { c.CloseNow() })
	}
	return c, resp, err
}

func subscribe(t *testing.T, c *websocket.Conn, topics ...string) {
	t.Helper()
	b, _ := json.Marshal(map[string][]string{"subscribe": topics})
	if err := c.Write(context.Background(), websocket.MessageText, b); err != nil {
		t.Fatal(err)
	}
	// The hub applies it before the next announcement is read.
	time.Sleep(100 * time.Millisecond)
}

// next is the next message, or nil after wait.
func next(t *testing.T, c *websocket.Conn, wait time.Duration) map[string]string {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), wait)
	defer cancel()
	_, data, err := c.Read(ctx)
	if err != nil {
		return nil
	}
	var m map[string]string
	_ = json.Unmarshal(data, &m)
	return m
}

func TestRealtimeNeedsASession(t *testing.T) {
	pool := testkit.DB(t)
	url := testkit.NewRealtime(t, pool)
	if _, resp, err := dial(t, url, "seller", ""); err == nil || resp == nil || resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("no cookie: %v", resp)
	}
	if _, resp, err := dial(t, url, "seller", "not-a-session"); err == nil || resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("a made-up cookie: %v", resp)
	}
	// A seller's session is for the seller app only.
	a := testkit.NewAPI(t, pool, "")
	token := a.SignIn(t, testkit.SellerA, "seller")
	if _, resp, err := dial(t, url, "backoffice", token); err == nil || resp.StatusCode != http.StatusForbidden {
		t.Fatalf("another app's session: %v", resp)
	}
}

func TestRealtimeDeliversOnlyWhatTheUserMaySee(t *testing.T) {
	pool := testkit.DB(t)
	url := testkit.NewRealtime(t, pool)
	a := testkit.NewAPI(t, pool, "")
	q := store.New(pool)
	ctx := context.Background()

	sellerA, _, err := dial(t, url, "seller", a.SignIn(t, testkit.SellerA, "seller"))
	if err != nil {
		t.Fatal(err)
	}
	sellerB, _, err := dial(t, url, "seller", a.SignIn(t, testkit.SellerB, "seller"))
	if err != nil {
		t.Fatal(err)
	}

	// Another tenant's store is refused out loud.
	subscribe(t, sellerA, realtime.StoreTopic(storeBCentral))
	if m := next(t, sellerA, time.Second); m["error"] != "topic_not_allowed" {
		t.Fatalf("another tenant's store: %v", m)
	}
	subscribe(t, sellerA, realtime.StoreTopic(storeACentral))
	subscribe(t, sellerB, realtime.StoreTopic(storeBCentral))

	if err := realtime.Announce(ctx, q, realtime.Event{Topic: realtime.StoreTopic(storeACentral), Kind: "order", ID: "o1"}); err != nil {
		t.Fatal(err)
	}
	if m := next(t, sellerA, 2*time.Second); m["kind"] != "order" || m["id"] != "o1" {
		t.Fatalf("seller A: %v", m)
	}
	if m := next(t, sellerB, 300*time.Millisecond); m != nil {
		t.Fatalf("seller B heard tenant A's store: %v", m)
	}

	// A change rolled back announces nothing.
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := realtime.Announce(ctx, q.WithTx(tx), realtime.Event{Topic: realtime.StoreTopic(storeACentral), Kind: "order", ID: "o2"}); err != nil {
		t.Fatal(err)
	}
	_ = tx.Rollback(ctx)
	if m := next(t, sellerA, 500*time.Millisecond); m != nil {
		t.Fatalf("a rolled-back change arrived: %v", m)
	}
}

// Signing out everywhere closes the user's sockets, and only theirs.
func TestRealtimeSignOutEverywhere(t *testing.T) {
	pool := testkit.DB(t)
	url := testkit.NewRealtime(t, pool)
	a := testkit.NewAPI(t, pool, "")

	phone1 := a.SignIn(t, testkit.SellerA, "seller")
	phone2 := a.SignIn(t, testkit.SellerA, "seller")
	other := a.SignIn(t, testkit.SellerB, "seller")
	s2, _, err := dial(t, url, "seller", phone2)
	if err != nil {
		t.Fatal(err)
	}
	so, _, err := dial(t, url, "seller", other)
	if err != nil {
		t.Fatal(err)
	}
	subscribe(t, s2, realtime.UserTopic(testkit.SellerA))

	if resp := a.Request(t, http.MethodPost, "/auth/logout-everywhere", "seller", testkit.Session(phone1)); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("sign out everywhere: %d", resp.StatusCode)
	}
	// Its session has ended, so its socket closes as "signed out" (the app then finds /me gone),
	// perhaps after the signed_out event itself.
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	for {
		_, _, err := s2.Read(ctx)
		if err == nil {
			continue
		}
		if websocket.CloseStatus(err) != websocket.StatusPolicyViolation {
			t.Fatalf("phone 2's socket stayed open: %v", err)
		}
		break
	}
	// Another user's socket stays open: it still answers a ping (read alongside, for the pong).
	pctx, pcancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer pcancel()
	go func() { _, _, _ = so.Read(pctx) }()
	if err := so.Ping(pctx); err != nil {
		t.Fatalf("another user's socket was closed: %v", err)
	}
	if _, resp, err := dial(t, url, "seller", phone2); err == nil || resp.StatusCode != http.StatusUnauthorized {
		t.Fatal("an ended session opened a socket")
	}
}
