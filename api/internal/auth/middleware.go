package auth

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/middleware"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

// Caller is who is calling a signed-in route; handlers read it with CallerFrom.
type Caller struct {
	UserID pgtype.UUID
	Role   string
	App    string
	// TenantID is set on tenant routes, already checked against the caller, and Level is the
	// caller's level in this app there.
	TenantID pgtype.UUID
	Level    Level
	token    string
}

type callerKey struct{}

func CallerFrom(ctx context.Context) (Caller, bool) {
	c, ok := ctx.Value(callerKey{}).(Caller)
	return c, ok
}

var (
	errNotSignedIn = httpx.New(http.StatusUnauthorized, "not_signed_in", "Sign in to continue")
	errNotAllowed  = httpx.New(http.StatusForbidden, "not_allowed", "Not allowed")
	errNotInTenant = httpx.New(http.StatusForbidden, "not_in_tenant", "Not allowed in this tenant")
	errTooMany     = httpx.New(http.StatusTooManyRequests, "too_many_requests", "Too many attempts, try again in a minute")
	errNoAccess    = httpx.New(http.StatusInternalServerError, "internal", "Something went wrong")
	errMaintenance = httpx.New(http.StatusServiceUnavailable, "maintenance", "Under maintenance, back soon")
)

// Flags are evaluated in memory (telemetry.Client); a nil one has every flag off.
type Flags interface {
	Enabled(key, distinctID string, props map[string]any) bool
	All(distinctID string, props map[string]any) map[string]bool
}

// MaintenanceFlag, while on, answers 503 to everyone but admins, who check before reopening.
const MaintenanceFlag = "ops-maintenance"

// FlagProps is who the caller is, for flag rules on role, app and (tenant routes) tenantId.
// The names are v1's, so its rules keep working; v1 sends no app.
func FlagProps(c Caller) map[string]any {
	p := map[string]any{"role": c.Role, "app": c.App}
	if c.TenantID.Valid {
		p["tenantId"] = c.TenantID.String()
	}
	return p
}

// Middleware enforces each route's Access: rate limit, session, app, role, tenant, maintenance.
// A route without an Access is refused, so forgetting one fails closed. perSession caps every
// signed-in session; past it, only a looping app could be calling, so the session ends.
func Middleware(sessions *Sessions, q *store.Queries, limiter, perSession *Limiter, flags Flags) func(huma.Context, func(huma.Context)) {
	return func(ctx huma.Context, next func(huma.Context)) {
		access, ok := ctx.Operation().Metadata[metadataKey].(Access)
		if !ok {
			slog.ErrorContext(ctx.Context(), "route has no access rule", "op", ctx.Operation().OperationID)
			write(ctx, errNoAccess)
			return
		}
		if access.RateLimited && !limiter.Allow(middleware.ClientIP(ctx.Context())) {
			write(ctx, errTooMany)
			return
		}
		if access.Public {
			next(ctx)
			return
		}

		cookie, err := huma.ReadCookie(ctx, CookieName)
		if err != nil || cookie.Value == "" {
			write(ctx, errNotSignedIn)
			return
		}
		session, renewed, err := sessions.Lookup(ctx.Context(), cookie.Value)
		if errors.Is(err, ErrNoSession) {
			write(ctx, errNotSignedIn)
			return
		}
		if err != nil {
			logLookup(ctx.Context(), "session lookup", err)
			write(ctx, errNoAccess)
			return
		}

		// Ended with the cookie on the same answer: any build of the app, old ones too, then gets a
		// 401 and goes to sign in, instead of asking again for ever.
		end := func(e *httpx.Error) {
			if err := sessions.Delete(ctx.Context(), cookie.Value); err != nil {
				logLookup(ctx.Context(), "end session", err)
			}
			c := Cookie("", 0, secure(ctx))
			ctx.AppendHeader("Set-Cookie", c.String())
			write(ctx, e)
		}
		if !perSession.Allow(session.ID.String()) {
			slog.ErrorContext(ctx.Context(), "session too fast, signed out",
				"user", session.UserID.String(), "app", session.App, "path", ctx.URL().Path)
			end(errTooMany)
			return
		}

		app := middleware.App(ctx.Context())
		if session.App != app {
			write(ctx, errNotAllowed)
			return
		}
		// Made inactive or out of this app since signing in: nothing this session asks can work.
		if !Allowed(app, session.Role, session.Status, session.Apps) {
			slog.InfoContext(ctx.Context(), "session no longer allowed, signed out",
				"user", session.UserID.String(), "app", app)
			end(errNotAllowed)
			return
		}

		caller := Caller{UserID: session.UserID, Role: session.Role, App: app, token: cookie.Value}
		info := middleware.InfoFrom(ctx.Context())
		info.SetCaller(caller.UserID.String(), "")
		if access.Tenant {
			m, err := q.GetUserTenant(ctx.Context(), store.GetUserTenantParams{
				App:    app,
				Slug:   ctx.Param("tenant"),
				UserID: session.UserID,
			})
			if errors.Is(err, pgx.ErrNoRows) {
				write(ctx, errNotInTenant)
				return
			}
			if err != nil {
				logLookup(ctx.Context(), "tenant lookup", err)
				write(ctx, errNoAccess)
				return
			}
			// An inactive member is out of the tenant from their next request; anyone in it needs a
			// level in this app there, and the route's own app and level when it names them.
			if m.Status != "active" {
				write(ctx, errNotInTenant)
				return
			}
			level := LevelIn(app, Membership{Status: m.Status, Owner: m.IsOwner, Access: m.Access, HasLevels: m.HasLevels, Role: session.Role})
			// Seller also needs an active account, read fresh so someone just let in gets in at once.
			if level == None || (app == "seller" && m.UserStatus != "active") ||
				(access.App != "" && (access.App != app || !level.AtLeast(access.Level))) {
				write(ctx, errNotAllowed)
				return
			}
			caller.TenantID, caller.Level = m.ID, level
			info.SetCaller(caller.UserID.String(), m.ID.String())
		}
		// After the tenant, so a rule can name one; routes outside a tenant match on role and app only.
		if caller.Role != "ADMIN" && flags.Enabled(MaintenanceFlag, caller.UserID.String(), FlagProps(caller)) {
			write(ctx, errMaintenance)
			return
		}

		if renewed {
			c := Cookie(cookie.Value, Lifetime, secure(ctx))
			ctx.AppendHeader("Set-Cookie", c.String())
		}
		next(huma.WithValue(ctx, callerKey{}, caller))
	}
}

// Token is the caller's session token, for signing out.
func (c Caller) Token() string { return c.token }

// Secure is false only for an app on plain http (localhost), where browsers would drop a
// Secure cookie; anything else, a missing origin included, gets Secure.
func Secure(origin string) bool { return !strings.HasPrefix(origin, "http://") }

func secure(ctx huma.Context) bool { return Secure(middleware.AppOrigin(ctx.Context())) }

func write(ctx huma.Context, e *httpx.Error) {
	ctx.SetHeader("Content-Type", "application/json")
	ctx.SetStatus(e.Status)
	_ = json.NewEncoder(ctx.BodyWriter()).Encode(e)
}

// logLookup logs a failed lookup; a request the phone gave up on (a reload) is no failure of ours.
func logLookup(ctx context.Context, what string, err error) {
	if errors.Is(err, context.Canceled) {
		slog.InfoContext(ctx, what, "err", err)
		return
	}
	slog.ErrorContext(ctx, what, "err", err)
}
