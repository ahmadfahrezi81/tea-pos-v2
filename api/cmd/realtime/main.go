// The WebSocket hub (Step 26). For now it only answers /health.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/config"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/handler"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/middleware"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/platform"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}
	platform.SetupLog("realtime", cfg.Env, cfg.LogLevel)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db, err := platform.OpenDB(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		slog.Error("database", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	mux := http.NewServeMux()
	handler.NewAPI(mux)

	if err := platform.Serve(ctx, ":"+cfg.Port, middleware.Standard(mux, cfg.RequestTimeout), cfg.ShutdownTimeout); err != nil {
		slog.Error("server", "err", err)
		os.Exit(1)
	}
}
