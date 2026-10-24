//go:build integration

package integration

import (
	"context"
	"io"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/idem"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

type writeInput struct {
	Body struct {
		Hour int `json:"hour"`
	}
}

type writeOutput struct {
	Body struct {
		Ran int64 `json:"ran"`
	}
}

// TestSavedOnce: a write route like the real ones (Idempotent, its change on the write's
// transaction), sent again, at once, by another user, with another body, and failing.
func TestSavedOnce(t *testing.T) {
	pool := testkit.DB(t)
	a := testkit.NewAPI(t, pool, "")
	var ran atomic.Int64
	var fail atomic.Bool
	op := huma.Operation{OperationID: "testWrite", Method: http.MethodPost, Path: "/test-write"}
	auth.Declare(&op, auth.SignedIn.Idempotent())
	huma.Register(a.Huma, op, func(ctx context.Context, in *writeInput) (*writeOutput, error) {
		if fail.Load() {
			return nil, huma.Error500InternalServerError("failing on purpose")
		}
		q := idem.Queries(ctx, store.New(pool))
		if err := q.UpsertWeatherHour(ctx, store.UpsertWeatherHourParams{Cell: "test", Date: pgtype.Date{Time: time.Date(2026, 10, 24, 0, 0, 0, 0, time.UTC), Valid: true}, Hour: int16(in.Body.Hour)}); err != nil {
			return nil, err
		}
		out := &writeOutput{}
		out.Body.Ran = ran.Add(1)
		return out, nil
	})
	rows := func() int { return count(t, pool, `SELECT count(*) FROM public.weather_hours WHERE cell = 'test'`) }
	seller := testkit.Session(a.SignIn(t, testkit.SellerA, "seller"))
	other := testkit.Session(a.SignIn(t, testkit.SellerB, "seller"))
	send := func(who *http.Cookie, key, body string) (int, string, bool) {
		var h []string
		if key != "" {
			h = []string{"Idempotency-Key: " + key}
		}
		resp := a.Send(t, http.MethodPost, "/test-write", "seller", body, h, who)
		b, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, string(b), resp.Header.Get("Idempotent-Replayed") == "true"
	}

	// Sent twice: one change, the same answer, the second replayed.
	s1, b1, r1 := send(seller, "key-00000001", `{"hour":1}`)
	s2, b2, r2 := send(seller, "key-00000001", `{"hour":1}`)
	if s1 != 200 || s2 != 200 || b1 != b2 || r1 || !r2 || ran.Load() != 1 || rows() != 1 {
		t.Fatalf("twice: %d %q %v / %d %q %v, ran %d, rows %d", s1, b1, r1, s2, b2, r2, ran.Load(), rows())
	}

	// Ten at once with one key: one runs, the others wait for it and get its answer.
	var wg sync.WaitGroup
	for range 10 {
		wg.Go(func() {
			if s, _, _ := send(seller, "key-00000002", `{"hour":2}`); s != 200 {
				t.Errorf("at once: %d", s)
			}
		})
	}
	wg.Wait()
	if ran.Load() != 2 || rows() != 2 {
		t.Fatalf("at once: ran %d, rows %d", ran.Load(), rows())
	}

	// Another user's same key is their own.
	if s, _, replayed := send(other, "key-00000001", `{"hour":3}`); s != 200 || replayed || ran.Load() != 3 {
		t.Fatalf("another user: %d %v, ran %d", s, replayed, ran.Load())
	}
	// The same key for another request is refused; no key at all too.
	if s, _, _ := send(seller, "key-00000001", `{"hour":9}`); s != http.StatusConflict {
		t.Fatalf("a key reused: %d", s)
	}
	if s, _, _ := send(seller, "", `{"hour":9}`); s != http.StatusBadRequest {
		t.Fatalf("no key: %d", s)
	}

	// A failure that may pass is not kept: the next try with the key runs, and saves.
	fail.Store(true)
	if s, _, _ := send(seller, "key-00000003", `{"hour":4}`); s != 500 {
		t.Fatalf("failing: %d", s)
	}
	fail.Store(false)
	if s, _, replayed := send(seller, "key-00000003", `{"hour":4}`); s != 200 || replayed || rows() != 4 {
		t.Fatalf("after a failure: %d %v, rows %d", s, replayed, rows())
	}
}
