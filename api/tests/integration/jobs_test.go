//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/jobs"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/weather"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

func count(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(context.Background(), sql, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// A job is saved with the change that needs it, or not at all.
func TestJobsSavedWithTheChange(t *testing.T) {
	pool := testkit.DB(t)
	ctx := context.Background()
	client, err := jobs.NewInserter(pool)
	if err != nil {
		t.Fatal(err)
	}
	change := `INSERT INTO public.weather_hours (cell, date, hour, temperature, precipitation_probability, weather_code)
		VALUES ('0.00,0.00', '2026-10-24', 9, 27, 10, 1000)`

	for _, commit := range []bool{false, true} {
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := tx.Exec(ctx, change); err != nil {
			t.Fatal(err)
		}
		if err := jobs.Insert(ctx, client, tx, jobs.WeatherArgs{}); err != nil {
			t.Fatal(err)
		}
		if commit {
			err = tx.Commit(ctx)
		} else {
			err = tx.Rollback(ctx)
		}
		if err != nil {
			t.Fatal(err)
		}
		want := 0
		if commit {
			want = 1
		}
		rows := count(t, pool, `SELECT count(*) FROM public.weather_hours WHERE cell = '0.00,0.00'`)
		queued := count(t, pool, `SELECT count(*) FROM river.river_job WHERE kind = 'weather'`)
		if rows != want || queued != want {
			t.Fatalf("commit %v: %d rows, %d jobs, want %d of each", commit, rows, queued, want)
		}
	}
}

// Two stores in one area and one 5 km away: two calls at noon, one at 20:30, none at night;
// the old app's table only for its own area; an observed hour never replaced by a forecast.
func TestWeatherByArea(t *testing.T) {
	pool := testkit.DB(t)
	ctx := context.Background()
	for _, s := range []struct {
		id        string
		lat, lng  float64
		open, end string
	}{
		{"00000000-0000-0000-0010-00000000000a", -6.60534, 106.76244, "08:00", "22:00"},
		{"00000000-0000-0000-0011-00000000000a", -6.60310, 106.76500, "09:00", "21:00"},
		{"00000000-0000-0000-0010-00000000000b", -6.59500, 106.80600, "10:00", "20:00"},
	} {
		if _, err := pool.Exec(ctx, `UPDATE public.stores SET latitude = $2, longitude = $3, open_time = $4, close_time = $5 WHERE id = $1`,
			s.id, s.lat, s.lng, s.open, s.end); err != nil {
			t.Fatal(err)
		}
	}

	var calls atomic.Int32
	var temp atomic.Int32
	temp.Store(30)
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		var req struct {
			Fields    []string `json:"fields"`
			Timesteps []string `json:"timesteps"`
			EndTime   string   `json:"endTime"`
		}
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &req)
		if len(req.Fields) != 3 || len(req.Timesteps) != 2 || req.EndTime != "nowPlus24h" || r.URL.Query().Get("apikey") != "test-key" {
			t.Errorf("asked for more than needed: %s", body)
		}
		now := time.Date(2026, 10, 24, 5, 10, 0, 0, time.UTC) // 12:10 WIB
		hour := now.Truncate(time.Hour)
		v := func(t float64) map[string]any {
			return map[string]any{"temperature": t, "precipitationProbability": 40, "weatherCode": 4001}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]any{"timelines": []any{
			map[string]any{"timestep": "current", "intervals": []any{map[string]any{"startTime": now, "values": v(float64(temp.Load()))}}},
			map[string]any{"timestep": "1h", "intervals": []any{
				map[string]any{"startTime": hour, "values": v(99)},
				map[string]any{"startTime": hour.Add(time.Hour), "values": v(26)},
			}},
		}}})
	}))
	t.Cleanup(fake.Close)

	f := &weather.Fetcher{Key: "test-key", Queries: store.New(pool), Endpoint: fake.URL}
	wib := func(h, m int) time.Time { return time.Date(2026, 10, 24, h, m, 0, 0, domain.WIB) }

	if err := f.Run(ctx, wib(3, 0), false); err != nil || calls.Load() != 0 {
		t.Fatalf("night: %d calls, %v", calls.Load(), err)
	}
	if err := f.Run(ctx, wib(12, 0), false); err != nil || calls.Load() != 2 {
		t.Fatalf("noon: %d calls, %v", calls.Load(), err)
	}
	near, far := domain.Cell(-6.60534, 106.76244), domain.Cell(-6.595, 106.806)
	if n := count(t, pool, `SELECT count(*) FROM public.weather_hours WHERE cell = $1`, near); n != 2 {
		t.Fatalf("near area: %d hours", n)
	}
	if n := count(t, pool, `SELECT count(*) FROM public.weather_hours WHERE cell = $1`, far); n != 2 {
		t.Fatalf("far area: %d hours", n)
	}
	// The current hour came from "current" (30), not the forecast for it (99).
	if n := count(t, pool, `SELECT count(*) FROM public.weather_hours WHERE cell = $1 AND hour = 12 AND observed AND temperature = 30`, near); n != 1 {
		t.Fatal("the observed hour was replaced by its forecast")
	}
	if n := count(t, pool, `SELECT count(*) FROM public.weather_hourly`); n != 2 {
		t.Fatalf("the old app's table: %d hours, want the near area's 2", n)
	}

	temp.Store(31)
	if err := f.Run(ctx, wib(20, 30), false); err != nil || calls.Load() != 3 {
		t.Fatalf("20:30: %d calls in all, %v", calls.Load(), err)
	}
	if n := count(t, pool, `SELECT count(*) FROM public.weather_hours WHERE cell = $1 AND hour = 12 AND temperature = 31`, near); n != 1 {
		t.Fatal("a newer observation did not replace the older")
	}
	// Staging's daily run fetches every area, open or not.
	if err := f.Run(ctx, wib(23, 0), true); err != nil || calls.Load() != 5 {
		t.Fatalf("all areas: %d calls in all, %v", calls.Load(), err)
	}
}

func TestEverySchedule(t *testing.T) {
	e := jobs.Every(20 * time.Minute)
	for _, c := range []struct{ now, want string }{
		{"12:00", "12:20"}, {"12:07", "12:20"}, {"12:59", "13:00"}, {"23:50", "00:00"},
	} {
		now, _ := time.ParseInLocation("15:04", c.now, domain.WIB)
		if got := e.Next(now).In(domain.WIB).Format("15:04"); got != c.want {
			t.Errorf("after %s: %s, want %s", c.now, got, c.want)
		}
	}
}

func TestDailySchedule(t *testing.T) {
	d := jobs.DailyAt(21)
	for _, c := range []struct{ now, want string }{
		{"2026-10-24 12:00", "2026-10-24 21:00"}, {"2026-10-24 21:00", "2026-10-25 21:00"}, {"2026-10-24 23:30", "2026-10-25 21:00"},
	} {
		now, _ := time.ParseInLocation("2006-01-02 15:04", c.now, domain.WIB)
		if got := d.Next(now).In(domain.WIB).Format("2006-01-02 15:04"); got != c.want {
			t.Errorf("after %s: %s, want %s", c.now, got, c.want)
		}
	}
}

// Every schedule builds in both environments (River refuses a bad one at start).
func TestSchedulesBuild(t *testing.T) {
	pool := testkit.DB(t)
	for _, env := range []string{"prod", "staging"} {
		if _, err := jobs.NewWorker(pool, jobs.Deps{Queries: store.New(pool)}, env, true); err != nil {
			t.Errorf("%s: %v", env, err)
		}
	}
}
