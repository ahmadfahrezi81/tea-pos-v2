//go:build integration

// Package testkit is shared by the integration and end-to-end tests.
package testkit

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Roles Supabase has and a plain Postgres lacks; cluster-wide, so made once per server.
const roles = `DO $$
DECLARE r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('CREATE ROLE %I NOLOGIN', r);
        END IF;
    END LOOP;
END $$`

// DB gives the test its own throwaway database: stubs, the schema dump and the base fixtures.
// TEST_DATABASE_URL points at a Postgres 17 server the tests may create databases on.
func DB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	ctx := context.Background()
	admin := os.Getenv("TEST_DATABASE_URL")
	if admin == "" {
		t.Fatal("TEST_DATABASE_URL is not set")
	}

	conn, err := pgx.Connect(ctx, admin)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer conn.Close(ctx)
	name := "test_" + randomHex()
	if _, err := conn.Exec(ctx, roles); err != nil {
		t.Fatalf("roles: %v", err)
	}
	if _, err := conn.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatalf("create database: %v", err)
	}
	t.Cleanup(func() {
		c, err := pgx.Connect(context.Background(), admin)
		if err != nil {
			return
		}
		defer c.Close(context.Background())
		_, _ = c.Exec(context.Background(), "DROP DATABASE IF EXISTS "+name+" WITH (FORCE)")
	})

	cfg, err := pgxpool.ParseConfig(admin)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	cfg.ConnConfig.Database = name
	load(t, ctx, cfg.ConnConfig)

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// load runs on its own connection: the dump empties search_path for the session that loads it.
func load(t *testing.T, ctx context.Context, cc *pgx.ConnConfig) {
	t.Helper()
	conn, err := pgx.ConnectConfig(ctx, cc)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer conn.Close(ctx)
	// The dump creates public itself; a new database already has one.
	if _, err := conn.Exec(ctx, "DROP SCHEMA public CASCADE"); err != nil {
		t.Fatalf("drop public: %v", err)
	}
	for _, f := range []string{"db/stubs.sql", "db/schema.sql", "tests/fixtures/base.sql"} {
		sql, err := os.ReadFile(filepath.Join(apiDir(), f))
		if err != nil {
			t.Fatalf("read %s: %v", f, err)
		}
		if _, err := conn.Exec(ctx, string(sql)); err != nil {
			t.Fatalf("load %s: %v", f, err)
		}
	}
}

func apiDir() string {
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "..", "..")
}

func randomHex() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
