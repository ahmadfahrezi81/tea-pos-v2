// Package jobs is v2's background work and its cron (River, in Postgres): the job kinds,
// the one way to queue a job (inside the change's own transaction), and the worker's
// schedules. A new kind is its Args, its Worker in Workers, and a schedule if it has one.
package jobs

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/weather"
)

// Schema holds River's tables (supabase/migrations/…_river_queue.sql).
const Schema = "river"

// Client is River's client over pgx.
type Client = river.Client[pgx.Tx]

// NewInserter is the API's client: it queues jobs, never runs them.
func NewInserter(pool *pgxpool.Pool) (*Client, error) {
	return river.NewClient(riverpgxv5.New(pool), &river.Config{Schema: Schema, Logger: slog.Default()})
}

// Insert queues a job inside tx, the transaction of the change that needs it: the change
// and its job are saved together, or neither is. There is no way to queue outside one.
func Insert(ctx context.Context, c *Client, tx pgx.Tx, args river.JobArgs) error {
	_, err := c.InsertTx(ctx, tx, args, nil)
	return err
}

// Deps is what the jobs use.
type Deps struct {
	Weather *weather.Fetcher
	Queries *store.Queries
}

// Schedule is one job on v2's cron, with when it runs in each environment; nil is never.
type Schedule struct {
	ID                  string
	Production, Staging river.PeriodicSchedule
	Args                func(env string) river.JobArgs
}

// Schedules is v2's whole cron, in one place: a new one is a line here. Railway runs them
// (JOBS_SCHEDULE); a laptop's worker runs only what is queued.
var Schedules = []Schedule{
	{ID: "cleanup", Production: Every(time.Hour), Staging: Every(time.Hour),
		Args: func(string) river.JobArgs { return CleanupArgs{} }},
	// Off until the old cron website stops fetching (Step 45): then production
	// Every(20*time.Minute), staging DailyAt(21).
	{ID: "weather", Production: nil, Staging: nil,
		Args: func(env string) river.JobArgs { return WeatherArgs{All: env != "prod"} }},
}

// NewWorker is the worker's client: it runs every kind, and env's schedules when schedule is
// set ("prod" or "staging", as config.Env).
func NewWorker(pool *pgxpool.Pool, d Deps, env string, schedule bool) (*Client, error) {
	workers := river.NewWorkers()
	river.AddWorker(workers, &WeatherWorker{Fetcher: d.Weather})
	river.AddWorker(workers, &CleanupWorker{Queries: d.Queries})

	var periodic []*river.PeriodicJob
	for _, s := range Schedules {
		when := s.Staging
		if env == "prod" {
			when = s.Production
		}
		if !schedule || when == nil {
			continue
		}
		periodic = append(periodic, river.NewPeriodicJob(when,
			func() (river.JobArgs, *river.InsertOpts) { return s.Args(env), nil },
			&river.PeriodicJobOpts{ID: s.ID}))
	}
	return river.NewClient(riverpgxv5.New(pool), &river.Config{
		Schema:       Schema,
		Queues:       map[string]river.QueueConfig{river.QueueDefault: {MaxWorkers: 5}},
		Workers:      workers,
		PeriodicJobs: periodic,
		JobTimeout:   5 * time.Minute,
		// New jobs arrive by LISTEN at once; this is only the fallback, kept slow to spare the database.
		FetchPollInterval: 5 * time.Second,
		Logger:            slog.Default(),
	})
}

// WeatherArgs fetches the weather of every store area open now, or of every area (All:
// staging's once a day).
type WeatherArgs struct {
	All bool `json:"all,omitempty"`
}

func (WeatherArgs) Kind() string { return "weather" }

// InsertOpts: one try more at most, since a run calls Tomorrow.io once per cell and the
// next run is 20 minutes away anyway.
func (WeatherArgs) InsertOpts() river.InsertOpts { return river.InsertOpts{MaxAttempts: 2} }

type WeatherWorker struct {
	river.WorkerDefaults[WeatherArgs]
	Fetcher *weather.Fetcher
}

func (w *WeatherWorker) Work(ctx context.Context, j *river.Job[WeatherArgs]) error {
	return w.Fetcher.Run(ctx, time.Now(), j.Args.All)
}

// CleanupArgs drops what is only kept for a while: Idempotency-Keys after 24 hours (017e).
type CleanupArgs struct{}

func (CleanupArgs) Kind() string { return "cleanup" }

type CleanupWorker struct {
	river.WorkerDefaults[CleanupArgs]
	Queries *store.Queries
}

func (w *CleanupWorker) Work(ctx context.Context, _ *river.Job[CleanupArgs]) error {
	n, err := w.Queries.DeleteOldIdempotencyKeys(ctx)
	if err == nil && n > 0 {
		slog.InfoContext(ctx, "cleanup", "idempotency_keys", n)
	}
	return err
}

// Every runs on the clock's own multiples (every 20 minutes: :00, :20, :40 WIB), not
// counted from whenever the worker started.
type Every time.Duration

func (e Every) Next(now time.Time) time.Time {
	d := time.Duration(e)
	return now.In(domain.WIB).Truncate(d).Add(d)
}

// DailyAt runs once a day at hour (WIB).
type DailyAt int

func (h DailyAt) Next(now time.Time) time.Time {
	now = now.In(domain.WIB)
	next := time.Date(now.Year(), now.Month(), now.Day(), int(h), 0, 0, 0, domain.WIB)
	if !next.After(now) {
		next = next.AddDate(0, 0, 1)
	}
	return next
}
