//go:build !testlogin

package handler

import "github.com/danielgtaylor/huma/v2"

// Without -tags testlogin (production) there is no test sign-in at all.
func registerTestLogin(huma.API, Deps) {}
