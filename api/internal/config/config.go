// Package config reads the environment once at start and refuses bad values.
package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/version"
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
	// Supabase does the Google exchange at sign-in; nothing else.
	SupabaseURL string
	SupabaseKey string
	// SupabaseSecretKey signs photo uploads and private reads (Storage); without it photos are off.
	SupabaseSecretKey string
	// TestLoginKey switches on the staging test sign-in, in a binary built with -tags testlogin.
	TestLoginKey string
	// MinAppVersions refuses older releases of an app with 426; an app not named has no cut-off.
	MinAppVersions map[string]version.Release
	// PostHog: errors, events and flags. Without a key nothing is sent and every flag is off.
	PostHogKey      string
	PostHogFlagsKey string
	PostHogHost     string
	// TomorrowKey is Tomorrow.io's, for the worker's weather.
	TomorrowKey string
	// JobsSchedule runs the worker's schedules (JOBS_SCHEDULE=on on Railway; off on a laptop,
	// so a local worker never runs them against staging's database).
	JobsSchedule bool
	// FlagsPoll is how often the flag rules are downloaded; PostHog bills each download as 10 flag checks.
	FlagsPoll time.Duration
}

func Load() (Config, error) {
	cfg := Config{
		Port:              getenv("PORT", "8080"),
		Env:               getenv("ENV", "local"),
		DatabaseURL:       os.Getenv("DATABASE_URL"),
		EdgeSecret:        os.Getenv("EDGE_SECRET"),
		SupabaseURL:       os.Getenv("SUPABASE_URL"),
		SupabaseKey:       os.Getenv("SUPABASE_PUBLISHABLE_KEY"),
		SupabaseSecretKey: os.Getenv("SUPABASE_SECRET_KEY"),
		TestLoginKey:      os.Getenv("TEST_LOGIN_KEY"),
		PostHogKey:        os.Getenv("POSTHOG_KEY"),
		PostHogFlagsKey:   os.Getenv("POSTHOG_FLAGS_KEY"),
		PostHogHost:       getenv("POSTHOG_HOST", "https://us.i.posthog.com"),
		TomorrowKey:       os.Getenv("TOMORROW_IO_API_KEY"),
	}
	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	if n := len(cfg.EdgeSecret); n > 0 && n < 32 {
		return Config{}, fmt.Errorf("EDGE_SECRET: want at least 32 characters (openssl rand -hex 32), got %d", n)
	}

	if cfg.TestLoginKey != "" {
		if cfg.Env == "prod" {
			return Config{}, errors.New("TEST_LOGIN_KEY must never be set in production")
		}
		if len(cfg.TestLoginKey) < 32 {
			return Config{}, errors.New("TEST_LOGIN_KEY: want at least 32 characters (openssl rand -hex 32)")
		}
	}

	switch v := os.Getenv("JOBS_SCHEDULE"); v {
	case "on":
		cfg.JobsSchedule = true
	case "", "off":
	default:
		return Config{}, fmt.Errorf("JOBS_SCHEDULE: want on or off, got %q", v)
	}
	if cfg.PostHogFlagsKey != "" && cfg.PostHogKey == "" {
		return Config{}, errors.New("POSTHOG_FLAGS_KEY needs POSTHOG_KEY")
	}

	if err := cfg.LogLevel.UnmarshalText([]byte(getenv("LOG_LEVEL", "info"))); err != nil {
		return Config{}, fmt.Errorf("LOG_LEVEL: %w", err)
	}

	var err error
	if cfg.MinAppVersions, err = minAppVersions(os.Getenv("MIN_APP_VERSION")); err != nil {
		return Config{}, err
	}
	if cfg.ShutdownTimeout, err = seconds("SHUTDOWN_TIMEOUT_SECONDS", 20); err != nil {
		return Config{}, err
	}
	if cfg.RequestTimeout, err = seconds("REQUEST_TIMEOUT_SECONDS", 10); err != nil {
		return Config{}, err
	}
	if cfg.FlagsPoll, err = seconds("POSTHOG_FLAGS_POLL_SECONDS", 60); err != nil {
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

// RequireSupabase is for the API, which signs users in.
func (c Config) RequireSupabase() error {
	if c.SupabaseURL == "" || c.SupabaseKey == "" {
		return errors.New("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required")
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

// minAppVersions reads "seller@2026.10.4,backoffice@2026.10.2".
func minAppVersions(s string) (map[string]version.Release, error) {
	out := map[string]version.Release{}
	for part := range strings.SplitSeq(s, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		app, v, _ := strings.Cut(part, "@")
		r, ok := version.ParseRelease(v)
		if (app != "seller" && app != "backoffice") || !ok {
			return nil, fmt.Errorf("MIN_APP_VERSION: want app@YYYY.MM.N, e.g. seller@2026.10.4, got %q", part)
		}
		out[app] = r
	}
	return out, nil
}
