// The WebSocket hub: live updates for every app (internal/realtime, task 017b).
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/config"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/handler"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/middleware"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/platform"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/realtime"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/telemetry"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}
	if err := cfg.RequireEdgeSecret(); err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}
	tel, err := telemetry.New(telemetry.Config{Key: cfg.PostHogKey, Host: cfg.PostHogHost})
	if err != nil {
		slog.Error("posthog", "err", err)
		os.Exit(1)
	}
	defer tel.Close()
	platform.SetupLog("realtime", cfg.Env, cfg.LogLevel, tel.Enqueuer())

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db, err := platform.OpenDB(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		slog.Error("database", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	q := store.New(db)
	hub := realtime.NewHub(auth.NewSessions(q), q)
	// Its own connection: LISTEN holds one for as long as it runs.
	go hub.Listen(ctx, db.Config().ConnConfig.Copy())
	go func() {
		<-ctx.Done()
		hub.CloseAll()
	}()

	mux := http.NewServeMux()
	handler.NewHealth(mux)
	mux.Handle("GET /realtime", hub)

	if err := platform.Serve(ctx, ":"+cfg.Port, middleware.Standard(mux, middleware.Options{RequestTimeout: cfg.RequestTimeout, EdgeSecret: cfg.EdgeSecret, MinAppVersions: cfg.MinAppVersions}), cfg.ShutdownTimeout); err != nil {
		slog.Error("server", "err", err)
		os.Exit(1)
	}
}
