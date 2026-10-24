// Package auth signs users in through Supabase and checks every request against Go's own sessions.
package auth

import (
	"encoding/json"
	"slices"

	"github.com/danielgtaylor/huma/v2"
)

// Access is who may call a route. Every route declares one; a route without fails the permission test.
type Access struct {
	Public bool `json:"public,omitempty"`
	// Roles allowed; empty means anyone the app lets in.
	Roles []string `json:"roles,omitempty"`
	// Tenant routes carry {tenant} (a slug) in the path; the caller must be assigned to it.
	Tenant bool `json:"tenant,omitempty"`
	// RateLimited routes allow a few calls a minute per caller IP (sign-in).
	RateLimited bool `json:"rateLimited,omitempty"`
	// Idempotent writes are saved once per Idempotency-Key (internal/idem). Every write route
	// is Idempotent or Repeatable; the permission test checks it.
	SavedOnce bool `json:"idempotent,omitempty"`
	// Repeatable writes are harmless to repeat (signing out, a language, a signed address).
	SafeToRepeat bool `json:"repeatable,omitempty"`
}

var (
	Public   = Access{Public: true}
	SignedIn = Access{}
)

func Roles(roles ...string) Access { return Access{Roles: roles} }

func (a Access) InTenant() Access        { a.Tenant = true; return a }
func (a Access) RateLimit() Access       { a.RateLimited = true; return a }
func (a Access) Idempotent() Access      { a.SavedOnce = true; return a }
func (a Access) Repeatable() Access      { a.SafeToRepeat = true; return a }
func (a Access) allows(role string) bool { return len(a.Roles) == 0 || slices.Contains(a.Roles, role) }

// MarshalJSON names a signed-in route as such in the spec, rather than an empty object.
func (a Access) MarshalJSON() ([]byte, error) {
	type plain Access
	return json.Marshal(struct {
		plain
		SignedIn bool `json:"signedIn,omitempty"`
	}{plain(a), !a.Public})
}

const metadataKey = "access"

// Declare attaches a to op, and to the spec as x-access so the permission test reads every route's rule.
func Declare(op *huma.Operation, a Access) {
	if op.Metadata == nil {
		op.Metadata = map[string]any{}
	}
	op.Metadata[metadataKey] = a
	if op.Extensions == nil {
		op.Extensions = map[string]any{}
	}
	op.Extensions["x-access"] = a
}

// AccessOf is a route's declared Access.
func AccessOf(op *huma.Operation) (Access, bool) {
	a, ok := op.Metadata[metadataKey].(Access)
	return a, ok
}

// appRoles is who each app lets in at all, as the old app did; a route narrows it further.
var appRoles = map[string][]string{
	"seller":     {"USER", "ADMIN"},
	"backoffice": {"ADMIN"},
}

// Allowed reports whether a user may use app at all. Seller also turns away accounts not active.
func Allowed(app, role, status string) bool {
	if !slices.Contains(appRoles[app], role) {
		return false
	}
	return app != "seller" || status == "active"
}
