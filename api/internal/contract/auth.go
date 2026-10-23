package contract

import "net/http"

// Redirect sends the browser on, setting or clearing cookies on the way.
type Redirect struct {
	Status    int           `json:"-"`
	Location  string        `header:"Location"`
	SetCookie []http.Cookie `header:"Set-Cookie"`
}

type AuthCallbackInput struct {
	Code string `query:"code" doc:"From Supabase after Google sign-in"`
	// Supabase reports a failed or cancelled sign-in here instead of a code.
	Error     string `query:"error"`
	Verifier  string `cookie:"tea_pkce" doc:"Set by /auth/google"`
	UserAgent string `header:"User-Agent"`
}

type LogoutOutput struct {
	SetCookie []http.Cookie `header:"Set-Cookie"`
}

// TestSignInInput is the staging-only test sign-in (built with -tags testlogin).
type TestSignInInput struct {
	Key       string `header:"X-Test-Key"`
	UserAgent string `header:"User-Agent"`
	Body      struct {
		Email string `json:"email" format:"email" example:"admin@test-a.test"`
	}
}
