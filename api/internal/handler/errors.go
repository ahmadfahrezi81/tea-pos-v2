package handler

import (
	"net/http"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
)

// The handlers' errors, declared here (whatever the build tags), so the contract lists every
// code and the apps translate each one.
var (
	errRouteNotFound = httpx.NotFound("route_not_found", "No such route")
	errUnknownApp    = httpx.New(http.StatusBadRequest, "unknown_app", "Open sign-in from the app")
	errAccountOff    = httpx.New(http.StatusForbidden, "account_inactive", "This account is not active")
	errNotInApp      = httpx.New(http.StatusForbidden, "not_allowed", "Not allowed in this app")
	errNotAllowed    = httpx.New(http.StatusForbidden, "not_allowed", "Not allowed")
	errStoreRequired = httpx.New(http.StatusBadRequest, "store_required", "A store's photo needs its store, and only those")
	errNotAStore     = httpx.New(http.StatusBadRequest, "bad_request", "Not a store")
	errStoreNotFound = httpx.NotFound("store_not_found", "No such store")
	errFilesOff      = httpx.New(http.StatusServiceUnavailable, "files_unavailable", "Photos cannot be uploaded right now")
	errFilesFailed   = httpx.New(http.StatusBadGateway, "files_unavailable", "Photos cannot be uploaded right now")
)
