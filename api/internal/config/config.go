// Package config reads the environment once at start and refuses bad values.
package config

import (
	"errors"
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
	DatabaseURL     string
	DBMaxConns      int32
}

func Load() (Config, error) {
	cfg := Config{
		Port:        getenv("PORT", "8080"),
		Env:         getenv("ENV", "local"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
	}
	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
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
	n, err := positive("DB_MAX_CONNS", 4)
	if err != nil {
		return Config{}, err
	}
	cfg.DBMaxConns = int32(n)
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func positive(key string, fallback int) (int, error) {
	n, err := strconv.Atoi(getenv(key, strconv.Itoa(fallback)))
	if err != nil || n <= 0 {
		return 0, fmt.Errorf("%s: want a positive integer, got %q", key, os.Getenv(key))
	}
	return n, nil
}

func seconds(key string, fallback int) (time.Duration, error) {
	n, err := positive(key, fallback)
	return time.Duration(n) * time.Second, err
}
