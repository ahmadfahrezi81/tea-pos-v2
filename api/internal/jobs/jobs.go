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

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/chatevent"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/push"
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

// ChatPushQueue queues a channel's push with c, in the change's transaction (chatevent.Post).
func ChatPushQueue(c *Client) chatevent.Queue {
	if c == nil {
		return nil
	}
	return func(ctx context.Context, tx pgx.Tx, channelID string) error {
		return Insert(ctx, c, tx, ChatPushArgs{ChannelID: channelID})
	}
}

// Deps is what the jobs use.
type Deps struct {
	Weather *weather.Fetcher
	Queries *store.Queries
	// Push sends chat's notifications; nil (no VAPID keys) sends none.
	Push *push.Sender
}

// Schedule is one job on v2's cron, with when it runs in each environment; nil is never.
type Schedule struct {
	ID                  string
	Production, Staging river.PeriodicSchedule
	Args                func(env string) river.JobArgs
	// OnStart also runs it as the worker starts (after each deploy).
	OnStart bool
}

// Schedules is v2's whole cron, in one place: a new one is a line here. Railway runs them
// (JOBS_SCHEDULE); a laptop's worker runs only what is queued.
var Schedules = []Schedule{
	{ID: "cleanup", Production: Every(time.Hour), Staging: DailyAt(4),
		Args: func(string) river.JobArgs { return CleanupArgs{} }},
	// Every 20 minutes around store hours; it also fills v1's weather_hourly, so the old cron
	// website is turned off once this runs (task 076). Staging: once a day, every area.
	{ID: "weather", Production: Every(20 * time.Minute), Staging: DailyAt(21),
		Args: func(env string) river.JobArgs { return WeatherArgs{All: env != "prod"} }},
	// What chat says by itself (Step 74).
	{ID: "day_summary", Production: At{23, 30}, Staging: At{23, 30},
		Args: func(string) river.JobArgs { return DaySummaryArgs{} }},
	{ID: "pay_total", Production: At{8, 0}, Staging: At{8, 0},
		Args: func(string) river.JobArgs { return PayTotalArgs{} }},
	{ID: "release", Production: At{9, 0}, Staging: At{9, 0}, OnStart: true,
		Args: func(string) river.JobArgs { return ReleaseArgs{} }},
}

// NewWorker is the worker's client: it runs every kind, and env's schedules when schedule is
// set ("prod" or "staging", as config.Env).
func NewWorker(pool *pgxpool.Pool, d Deps, env string, schedule bool) (*Client, error) {
	workers := river.NewWorkers()
	events := chatevent.Poster{Pool: pool, Queue: func(ctx context.Context) chatevent.Queue {
		return ChatPushQueue(river.ClientFromContext[pgx.Tx](ctx))
	}}
	river.AddWorker(workers, &WeatherWorker{Fetcher: d.Weather, Events: events})
	river.AddWorker(workers, &DaySummaryWorker{Events: events})
	river.AddWorker(workers, &PayTotalWorker{Events: events})
	river.AddWorker(workers, &ReleaseWorker{Events: events})
	river.AddWorker(workers, &CleanupWorker{Queries: d.Queries})
	river.AddWorker(workers, &ChatPushWorker{Queries: d.Queries, Push: d.Push})

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
			&river.PeriodicJobOpts{ID: s.ID, RunOnStart: s.OnStart}))
	}
	return river.NewClient(riverpgxv5.New(pool), &river.Config{
		Schema:       Schema,
		Queues:       map[string]river.QueueConfig{river.QueueDefault: {MaxWorkers: 5}},
		Workers:      workers,
		PeriodicJobs: periodic,
		JobTimeout:   5 * time.Minute,
		// New jobs arrive by LISTEN at once; this is only the fallback for a missed notice. Each
		// poll is a query, all day in both environments: most of the worker's CPU and traffic.
		FetchPollInterval: time.Minute,
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
	Events  chatevent.Poster
}

// Work fetches, then tells the open stores' chats of rain from what came back, even when a
// cell failed (the others' forecasts are new).
func (w *WeatherWorker) Work(ctx context.Context, j *river.Job[WeatherArgs]) error {
	now := time.Now()
	err := w.Fetcher.Run(ctx, now, j.Args.All)
	if rain := w.Events.Rain(ctx, now); rain != nil {
		slog.ErrorContext(ctx, "rain alerts", "err", rain)
	}
	return err
}

// DaySummaryArgs posts each store's day to its chat, at night.
type DaySummaryArgs struct{}

func (DaySummaryArgs) Kind() string { return "day_summary" }

type DaySummaryWorker struct {
	river.WorkerDefaults[DaySummaryArgs]
	Events chatevent.Poster
}

func (w *DaySummaryWorker) Work(ctx context.Context, _ *river.Job[DaySummaryArgs]) error {
	return w.Events.DaySummaries(ctx, time.Now().In(domain.WIB))
}

// PayTotalArgs posts a pay period's total to VIP the morning after it ends.
type PayTotalArgs struct{}

func (PayTotalArgs) Kind() string { return "pay_total" }

type PayTotalWorker struct {
	river.WorkerDefaults[PayTotalArgs]
	Events chatevent.Poster
}

func (w *PayTotalWorker) Work(ctx context.Context, _ *river.Job[PayTotalArgs]) error {
	return w.Events.PayTotals(ctx, time.Now())
}

// ReleaseArgs links the newest What's new in General, once per version.
type ReleaseArgs struct{}

func (ReleaseArgs) Kind() string { return "release" }

type ReleaseWorker struct {
	river.WorkerDefaults[ReleaseArgs]
	Events chatevent.Poster
}

func (w *ReleaseWorker) Work(ctx context.Context, _ *river.Job[ReleaseArgs]) error {
	return w.Events.Releases(ctx)
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

// At runs once a day at Hour:Minute (WIB).
type At struct{ Hour, Minute int }

func (a At) Next(now time.Time) time.Time {
	now = now.In(domain.WIB)
	next := time.Date(now.Year(), now.Month(), now.Day(), a.Hour, a.Minute, 0, 0, domain.WIB)
	if !next.After(now) {
		next = next.AddDate(0, 0, 1)
	}
	return next
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
