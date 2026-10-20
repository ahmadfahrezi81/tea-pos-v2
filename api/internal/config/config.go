// Package config reads the environment once at start and refuses bad values.
package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port            string
	Env             string
	LogLevel        slog.Level
	ShutdownTimeout time.Duration
	RequestTimeout  time.Duration
}

func Load() (Config, error) {
	cfg := Config{
		Port: getenv("PORT", "8080"),
		Env:  getenv("ENV", "local"),
	}

	if err := cfg.LogLevel.UnmarshalText([]byte(getenv("LOG_LEVEL", "info"))); err != nil {
		return Config{}, fmt.Errorf("LOG_LEVEL: %w", err)
	}

	var err error
	if cfg.ShutdownTimeout, err = seconds("SHUTDOWN_TIMEOUT_SECONDS", 20); err != nil {
		return Config{}, err
	}
	if cfg.RequestTimeout, err = seconds("REQUEST_TIMEOUT_SECONDS", 10); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func seconds(key string, fallback int) (time.Duration, error) {
	n, err := strconv.Atoi(getenv(key, strconv.Itoa(fallback)))
	if err != nil || n <= 0 {
		return 0, fmt.Errorf("%s: want a positive integer, got %q", key, os.Getenv(key))
	}
	return time.Duration(n) * time.Second, nil
}
