// Background jobs and schedules (River, Step 17). For now it starts and waits for the stop signal.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/config"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/platform"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/version"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}
	platform.SetupLog("worker", cfg.Env, cfg.LogLevel)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	slog.Info("started", "version", version.Version, "commit", version.Commit)
	<-ctx.Done()
	slog.Info("stopped")
}
