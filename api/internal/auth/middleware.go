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
	// TenantID is set on tenant routes, already checked against the caller.
	TenantID pgtype.UUID
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
)

// Middleware enforces each route's Access: rate limit, session, app, role, tenant. A route
// without an Access is refused, so forgetting one fails closed.
func Middleware(sessions *Sessions, q *store.Queries, limiter *Limiter) func(huma.Context, func(huma.Context)) {
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
			slog.ErrorContext(ctx.Context(), "session lookup", "err", err)
			write(ctx, errNoAccess)
			return
		}

		app := middleware.App(ctx.Context())
		if session.App != app || !Allowed(app, session.Role, session.Status) || !access.allows(session.Role) {
			write(ctx, errNotAllowed)
			return
		}

		caller := Caller{UserID: session.UserID, Role: session.Role, App: app, token: cookie.Value}
		if access.Tenant {
			tenantID, err := q.GetUserTenant(ctx.Context(), store.GetUserTenantParams{
				Slug:   ctx.Param("tenant"),
				UserID: session.UserID,
			})
			if errors.Is(err, pgx.ErrNoRows) {
				write(ctx, errNotInTenant)
				return
			}
			if err != nil {
				slog.ErrorContext(ctx.Context(), "tenant lookup", "err", err)
				write(ctx, errNoAccess)
				return
			}
			caller.TenantID = tenantID
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
