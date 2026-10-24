package handler

import (
	"net/http"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
)

// The handlers' errors, declared here (whatever the build tags), so the contract lists every
// code and the apps translate each one.
var (
	errRouteNotFound          = httpx.NotFound("route_not_found", "No such route")
	errUnknownApp             = httpx.New(http.StatusBadRequest, "unknown_app", "Open sign-in from the app")
	errAccountOff             = httpx.New(http.StatusForbidden, "account_inactive", "This account is not active")
	errNotInApp               = httpx.New(http.StatusForbidden, "not_allowed", "Not allowed in this app")
	errNotAllowed             = httpx.New(http.StatusForbidden, "not_allowed", "Not allowed")
	errStoreRequired          = httpx.New(http.StatusBadRequest, "store_required", "A store's photo needs its store, and only those")
	errNotAStore              = httpx.New(http.StatusBadRequest, "bad_request", "Not a store")
	errStoreNotFound          = httpx.NotFound("store_not_found", "No such store")
	errFilesOff               = httpx.New(http.StatusServiceUnavailable, "files_unavailable", "Photos cannot be uploaded right now")
	errFilesFailed            = httpx.New(http.StatusBadGateway, "files_unavailable", "Photos cannot be uploaded right now")
	errBadCursor              = httpx.New(http.StatusBadRequest, "bad_cursor", "This list's place is out of date; start again from the top")
	errStaffNotFound          = httpx.NotFound("staff_not_found", "No such staff member")
	errCommissionTypeNotFound = httpx.NotFound("commission_type_not_found", "No such commission type, or it is switched off")
	errClaimTypeNotFound      = httpx.NotFound("claim_type_not_found", "No such claim type")
	errAutoNeedsHours         = httpx.New(http.StatusBadRequest, "auto_needs_hours", "An automatic claim type needs its minimum hours worked")
	errPayoutNotFound         = httpx.NotFound("payout_not_found", "No such payout")
	errCommissionNotFound     = httpx.NotFound("commission_not_found", "No such commission")
	errClaimNotFound          = httpx.NotFound("claim_not_found", "No such claim")
	errDayNotInPayout         = httpx.New(http.StatusBadRequest, "day_not_in_payout", "That day is not in this payout's period")
	errPayoutSettled          = httpx.New(http.StatusUnprocessableEntity, "payout_settled", "This payout is paid or skipped: its decisions can no longer change")
	errPayoutNotDue           = httpx.New(http.StatusUnprocessableEntity, "payout_not_due", "This period has not reached its last day yet")
	errPayoutPendingReview    = httpx.New(http.StatusUnprocessableEntity, "payout_pending_review", "Every commission and claim must be reviewed first")
	errProofRequired          = httpx.New(http.StatusBadRequest, "proof_required", "Paying needs the transfer screenshot")
	errBadProof               = httpx.New(http.StatusBadRequest, "bad_proof", "That screenshot was not uploaded as this tenant's payroll proof")
	errDayNotFound            = httpx.NotFound("day_not_found", "No such day")
	errBadRange               = httpx.New(http.StatusBadRequest, "bad_range", "Pick a range of at most 400 days, from before to")
)
