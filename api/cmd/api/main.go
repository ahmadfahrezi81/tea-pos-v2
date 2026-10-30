// The REST API for every app, and incoming payment webhooks.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/config"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/files"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/handler"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/middleware"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/platform"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/telemetry"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}
	if err := errors.Join(cfg.RequireEdgeSecret(), cfg.RequireSupabase()); err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}
	tel, err := telemetry.New(telemetry.Config{
		Key: cfg.PostHogKey, FlagsKey: cfg.PostHogFlagsKey, Host: cfg.PostHogHost, FlagsPoll: cfg.FlagsPoll,
	})
	if err != nil {
		slog.Error("posthog", "err", err)
		os.Exit(1)
	}
	defer tel.Close()
	platform.SetupLog("api", cfg.Env, cfg.LogLevel, tel.Enqueuer())
	if cfg.SupabaseSecretKey == "" {
		slog.Warn("SUPABASE_SECRET_KEY is not set: photo uploads answer 503")
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db, err := platform.OpenDB(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		slog.Error("database", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	q := store.New(db)
	mux := http.NewServeMux()
	handler.NewAPI(mux, handler.Deps{
		Docs:         cfg.Env == "local",
		DB:           db,
		Queries:      q,
		Sessions:     auth.NewSessions(q),
		Supabase:     auth.NewSupabase(cfg.SupabaseURL, cfg.SupabaseKey),
		TestLoginKey: cfg.TestLoginKey,
		Telemetry:    tel,
		Files:        files.NewStorage(cfg.SupabaseURL, cfg.SupabaseSecretKey),
	})

	if err := platform.Serve(ctx, ":"+cfg.Port, middleware.Standard(mux, middleware.Options{RequestTimeout: cfg.RequestTimeout, EdgeSecret: cfg.EdgeSecret, MinAppVersions: cfg.MinAppVersions}), cfg.ShutdownTimeout); err != nil {
		slog.Error("server", "err", err)
		os.Exit(1)
	}
}
