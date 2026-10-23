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
	EdgeSecret      string
}

func Load() (Config, error) {
	cfg := Config{
		Port:        getenv("PORT", "8080"),
		Env:         getenv("ENV", "local"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		EdgeSecret:  os.Getenv("EDGE_SECRET"),
	}
	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	if n := len(cfg.EdgeSecret); n > 0 && n < 32 {
		return Config{}, fmt.Errorf("EDGE_SECRET: want at least 32 characters (openssl rand -hex 32), got %d", n)
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
	// Supabase's pooler allows far fewer; a bigger number is a typo.
	if n > 100 {
		return Config{}, fmt.Errorf("DB_MAX_CONNS: want at most 100, got %d", n)
	}
	cfg.DBMaxConns = int32(n)
	return cfg, nil
}

// RequireEdgeSecret is for programs that serve the apps through the forwarder.
func (c Config) RequireEdgeSecret() error {
	if c.EdgeSecret == "" {
		return errors.New("EDGE_SECRET is required")
	}
	return nil
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
