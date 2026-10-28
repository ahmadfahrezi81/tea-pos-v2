//go:build testlogin

package handler

import (
	"context"
	"crypto/subtle"
	"log/slog"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/middleware"
)

// registerTestLogin is staging's sign-in for automated tests: a test tenant's user, by email,
// with the secret key. It makes a real session, so everything after runs as in production.
func registerTestLogin(api huma.API, d Deps) {
	if d.TestLoginKey == "" {
		return
	}
	slog.Warn("test sign-in is on: POST /auth/test (staging only)")
	// Anything wrong looks like a route that does not exist.
	notFound := errRouteNotFound

	route(api, huma.Operation{
		OperationID:   "testSignIn",
		Method:        http.MethodPost,
		Path:          "/auth/test",
		Summary:       "Staging only: sign in as a test user",
		Tags:          []string{"auth"},
		DefaultStatus: http.StatusNoContent,
		// Not rate limited: the 64-character key cannot be guessed, and the e2e suite signs in often.
	}, auth.Public.Repeatable(), func(ctx context.Context, in *contract.TestSignInInput) (*contract.LogoutOutput, error) {
		if subtle.ConstantTimeCompare([]byte(in.Key), []byte(d.TestLoginKey)) != 1 {
			return nil, notFound
		}
		app := middleware.App(ctx)
		user, err := d.Queries.GetTestUser(ctx, in.Body.Email)
		if err != nil || app == "" {
			return nil, notFound
		}
		if !auth.Allowed(app, user.Role, user.Status, user.Apps) {
			if user.Status != "active" {
				return nil, errAccountOff
			}
			return nil, errNotInApp
		}
		token, err := d.Sessions.Create(ctx, user.ID, app, middleware.ClientIP(ctx), in.UserAgent)
		if err != nil {
			return nil, err
		}
		cookie := auth.Cookie(token, auth.Lifetime, auth.Secure(middleware.AppOrigin(ctx)))
		return &contract.LogoutOutput{SetCookie: []http.Cookie{cookie}}, nil
	})
}
