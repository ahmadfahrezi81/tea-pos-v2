package handler

import (
	"context"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/middleware"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

// The PKCE verifier lives in its own short cookie, only on the sign-in paths the browser sees.
const (
	pkceCookie = "tea_pkce"
	pkcePath   = "/api/auth"
	pkceMaxAge = 10 * time.Minute
)

func pkce(value string, maxAge time.Duration, secure bool) http.Cookie {
	c := http.Cookie{Name: pkceCookie, Value: value, Path: pkcePath, HttpOnly: true, Secure: secure,
		SameSite: http.SameSiteLaxMode, MaxAge: int(maxAge.Seconds())}
	if maxAge == 0 {
		c.MaxAge = -1
	}
	return c
}

func registerAuth(api huma.API, d Deps) {
	route(api, huma.Operation{
		OperationID:   "startSignIn",
		Method:        http.MethodGet,
		Path:          "/auth/google",
		Summary:       "Start Google sign-in",
		Tags:          []string{"auth"},
		DefaultStatus: http.StatusFound,
	}, auth.Public.RateLimit(), func(ctx context.Context, _ *struct{}) (*contract.Redirect, error) {
		origin := middleware.AppOrigin(ctx)
		if origin == "" || middleware.App(ctx) == "" {
			return nil, httpx.New(http.StatusBadRequest, "unknown_app", "Open sign-in from the app")
		}
		verifier, challenge := auth.NewPKCE()
		return &contract.Redirect{
			Status:    http.StatusFound,
			Location:  d.Supabase.AuthorizeURL(origin+"/api/auth/callback", challenge),
			SetCookie: []http.Cookie{pkce(verifier, pkceMaxAge, auth.Secure(origin))},
		}, nil
	})

	route(api, huma.Operation{
		OperationID:   "finishSignIn",
		Method:        http.MethodGet,
		Path:          "/auth/callback",
		Summary:       "Finish Google sign-in and set the session cookie",
		Tags:          []string{"auth"},
		DefaultStatus: http.StatusFound,
	}, auth.Public.RateLimit(), func(ctx context.Context, in *contract.AuthCallbackInput) (*contract.Redirect, error) {
		origin := middleware.AppOrigin(ctx)
		app := middleware.App(ctx)
		secure := auth.Secure(origin)
		// Every outcome lands back on the app; a failure names its reason for the sign-in screen.
		back := func(path string, cookies ...http.Cookie) *contract.Redirect {
			return &contract.Redirect{
				Status:    http.StatusFound,
				Location:  path,
				SetCookie: append(cookies, pkce("", 0, secure)),
			}
		}
		fail := func(code, why string) (*contract.Redirect, error) {
			slog.InfoContext(ctx, "sign-in refused", "app", app, "code", code, "why", why)
			return back("/login?error=" + url.QueryEscape(code)), nil
		}
		switch {
		case app == "":
			return fail("sign_in_failed", "no app header")
		case in.Error != "":
			return fail("sign_in_failed", "supabase: "+in.Error)
		case in.Code == "":
			return fail("sign_in_failed", "no code")
		case in.Verifier == "":
			return fail("sign_in_failed", "no pkce cookie")
		}

		user, err := d.Supabase.Exchange(ctx, in.Code, in.Verifier)
		if err != nil {
			return fail("sign_in_failed", "exchange: "+err.Error())
		}
		var id pgtype.UUID
		if err := id.Scan(user.ID); err != nil {
			return fail("sign_in_failed", "bad user id")
		}
		row, err := d.Queries.GetUserForSignIn(ctx, id)
		if err != nil {
			return fail("not_allowed", "no tea-pos user for this Google account")
		}
		if !auth.Allowed(app, row.Role, row.Status) {
			if row.Status != "active" {
				return fail("account_inactive", "status "+row.Status)
			}
			return fail("not_allowed", "role "+row.Role)
		}
		if avatar := user.Metadata.AvatarURL; avatar != "" {
			if err := d.Queries.SetUserAvatar(ctx, store.SetUserAvatarParams{ID: id, AvatarUrl: pgtype.Text{String: avatar, Valid: true}}); err != nil {
				slog.WarnContext(ctx, "avatar sync", "err", err)
			}
		}

		token, err := d.Sessions.Create(ctx, id, app, middleware.ClientIP(ctx), in.UserAgent)
		if err != nil {
			return nil, err
		}
		return back("/", auth.Cookie(token, auth.Lifetime, secure)), nil
	})

	route(api, huma.Operation{
		OperationID:   "signOut",
		Method:        http.MethodPost,
		Path:          "/auth/logout",
		Summary:       "Sign out of this app on this phone",
		Tags:          []string{"auth"},
		DefaultStatus: http.StatusNoContent,
	}, auth.SignedIn, func(ctx context.Context, _ *struct{}) (*contract.LogoutOutput, error) {
		caller, _ := auth.CallerFrom(ctx)
		if err := d.Sessions.Delete(ctx, caller.Token()); err != nil {
			return nil, err
		}
		return &contract.LogoutOutput{
			SetCookie: []http.Cookie{auth.Cookie("", 0, auth.Secure(middleware.AppOrigin(ctx)))},
		}, nil
	})
}
