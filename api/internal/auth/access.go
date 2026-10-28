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
	// App and Level: the caller's level in that app, in the route's tenant, must be at least Level.
	App   string `json:"app,omitempty"`
	Level Level  `json:"level,omitempty"`
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

// App is a tenant route for callers with at least level in app: a guest reads, an admin writes.
func App(app string, level Level) Access { return Access{App: app, Level: level, Tenant: true} }

func (a Access) InTenant() Access   { a.Tenant = true; return a }
func (a Access) RateLimit() Access  { a.RateLimited = true; return a }
func (a Access) Idempotent() Access { a.SavedOnce = true; return a }
func (a Access) Repeatable() Access { a.SafeToRepeat = true; return a }

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

// Level is what someone may do in one app of one tenant; each app offers only some (Levels).
type Level string

const (
	None   Level = ""
	Guest  Level = "guest"  // look only
	Member Level = "member" // use it
	Admin  Level = "admin"  // manage it
)

// Levels is what each app offers; the UAC screens show only these, and Go refuses any other.
var Levels = map[string][]Level{
	"seller":     {Member},
	"backoffice": {Guest, Admin},
}

// AtLeast reports whether l reaches want.
func (l Level) AtLeast(want Level) bool { return rank(l) >= rank(want) }

func rank(l Level) int { return slices.Index([]Level{None, Guest, Member, Admin}, l) }

// roleLevels is users.role read as levels, for anyone without a level row yet: everyone before
// the backfill, and people v1 adds while it runs. Goes when v1 retires.
var roleLevels = map[string]map[string]Level{
	"USER":  {"seller": Member},
	"ADMIN": {"seller": Member, "backoffice": Admin},
}

// LevelIn is someone's level in app in one tenant: the owner is always an admin, an inactive
// member has none, a level row decides, and with no row anywhere in the tenant, users.role.
func LevelIn(app string, m Membership) Level {
	switch {
	case m.Status != "active":
		return None
	case m.Owner:
		return Admin
	case m.HasLevels:
		return Level(m.Access)
	default:
		return roleLevels[m.Role][app]
	}
}

// Membership is what LevelIn reads about one person in one tenant.
type Membership struct {
	Status    string
	Owner     bool
	Access    string
	HasLevels bool
	Role      string
}

// Allowed reports whether a user may use app at all: some tenant gives them a level there (apps,
// from their level rows), or, with no rows at all, users.role does. Seller also turns away
// accounts not active. Someone new (pending, in no app yet) may sign in only to ask for access:
// every tenant route still refuses them.
func Allowed(app, role, status string, apps []string) bool {
	if status == "pending" && len(apps) == 0 {
		return true
	}
	in := slices.Contains(apps, app)
	if len(apps) == 0 {
		in = roleLevels[role][app] != None
	}
	return in && (app != "seller" || status == "active")
}
