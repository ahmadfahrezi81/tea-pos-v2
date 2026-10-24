// Background jobs and v2's cron (River): the job kinds and schedules are in internal/jobs.
// `worker -once weather` runs the weather once for every store area and exits (by hand).
package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/config"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/jobs"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/platform"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/telemetry"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/version"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/weather"
)

func main() {
	once := flag.String("once", "", "run one job now and exit: weather")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}
	if *once == "weather" && cfg.TomorrowKey == "" {
		slog.Error("config", "err", errors.New("TOMORROW_IO_API_KEY is required for the weather"))
		os.Exit(1)
	}
	tel, err := telemetry.New(telemetry.Config{Key: cfg.PostHogKey, Host: cfg.PostHogHost})
	if err != nil {
		slog.Error("posthog", "err", err)
		os.Exit(1)
	}
	defer tel.Close()
	platform.SetupLog("worker", cfg.Env, cfg.LogLevel, tel.Enqueuer())

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db, err := platform.OpenDB(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		slog.Error("database", "err", err)
		os.Exit(1)
	}
	defer db.Close()
	q := store.New(db)
	fetcher := &weather.Fetcher{Key: cfg.TomorrowKey, Queries: q}

	switch *once {
	case "":
	case "weather":
		if err := fetcher.Run(ctx, time.Now(), true); err != nil {
			slog.Error("weather", "err", err)
			os.Exit(1)
		}
		return
	default:
		slog.Error("unknown job", "once", *once)
		os.Exit(1)
	}

	client, err := jobs.NewWorker(db, jobs.Deps{Weather: fetcher, Queries: q}, cfg.Env, cfg.JobsSchedule)
	if err != nil {
		slog.Error("jobs", "err", err)
		os.Exit(1)
	}
	if err := client.Start(ctx); err != nil {
		slog.Error("jobs", "err", err)
		os.Exit(1)
	}
	slog.Info("started", "version", version.Version, "commit", version.Commit, "schedules", cfg.JobsSchedule)
	<-ctx.Done()

	// Lets running jobs finish, within Railway's grace period.
	stopCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	if err := client.Stop(stopCtx); err != nil {
		slog.Error("jobs stop", "err", err)
	}
	slog.Info("stopped")
}
