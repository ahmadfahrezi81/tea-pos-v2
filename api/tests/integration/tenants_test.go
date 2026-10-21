//go:build integration

package integration

import (
	"context"
	"testing"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/tests/testkit"
)

func TestTenants_GetBySlug_ReturnsOnlyThatTenant(t *testing.T) {
	q := store.New(testkit.DB(t))
	ctx := context.Background()

	for slug, want := range map[string]string{
		"tenant-a": "Tenant A",
		"tenant-b": "Tenant B",
	} {
		got, err := q.GetTenantBySlug(ctx, slug)
		if err != nil {
			t.Fatalf("%s: %v", slug, err)
		}
		if got.Name != want {
			t.Errorf("%s: got %q, want %q", slug, got.Name, want)
		}
	}

	if _, err := q.GetTenantBySlug(ctx, "missing"); err == nil {
		t.Error("missing: want an error, got a tenant")
	}
}
