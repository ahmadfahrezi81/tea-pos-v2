package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/files"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/httpx"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/idem"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

var (
	errClaimNotEligible = httpx.New(http.StatusForbidden, "claim_not_eligible", "You cannot submit this claim")
	errClaimTooOld      = httpx.New(http.StatusUnprocessableEntity, "claim_too_old", "That date is too far back")
	errClaimDone        = httpx.New(http.StatusConflict, "claim_done", "You have already submitted this claim")
	errPeriodClosed     = httpx.New(http.StatusConflict, "period_closed", "This pay period is already closed")
	errNoWorkThatDay    = httpx.New(http.StatusUnprocessableEntity, "no_work_that_day", "You did not work that day")
	errBadReceipt       = httpx.New(http.StatusUnprocessableEntity, "bad_receipt", "That receipt did not upload properly")
)

// claimWindow is how far back a claim may be dated, as v1.
const claimWindow = 14

// registerMine is a seller's own pay and claims: always the caller's, never anyone else's.
func registerMine(api huma.API, d Deps) {
	op := func(id, method, path, summary string) huma.Operation {
		return huma.Operation{OperationID: id, Method: method, Path: "/tenants/{tenant}/my" + path, Summary: summary, Tags: []string{"seller"}}
	}

	route(api, op("getMyPay", http.MethodGet, "/pay", "How the caller is paid, and every period so far"), sellerAccess,
		func(ctx context.Context, _ *contract.TenantInput) (*contract.MyPayOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			info, err := d.Queries.MyPayInfo(ctx, store.MyPayInfoParams{UserID: caller.UserID, TenantID: caller.TenantID})
			if err != nil {
				return nil, err
			}
			_, end, err := domain.PayWindow(wibToday(), info.PayFrequency)
			if err != nil {
				return nil, err
			}
			rows, err := d.Queries.ListPayouts(ctx, store.ListPayoutsParams{
				TenantID: caller.TenantID, OnlyUser: caller.UserID,
				FromDate: date(time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)), ToDate: date(time.Date(2100, 1, 1, 0, 0, 0, 0, time.UTC)),
			})
			if err != nil {
				return nil, err
			}
			out := &contract.MyPayOutput{}
			b := &out.Body
			b.PayFrequency, b.NextPayout, b.Slug = info.PayFrequency, domain.PayoutDate(end).Format(time.DateOnly), info.Slug
			if info.RatePerCup.Valid {
				rate := int64(info.RatePerCup.Int32)
				b.RatePerCup = &rate
			}
			b.Payouts = make([]contract.Payout, len(rows))
			for i, r := range rows {
				b.Payouts[i] = contract.Payout{
					ID: r.ID.String(), UserID: r.UserID.String(), Name: r.FullName, Status: r.Status,
					Start: day0(r.StartDate), End: day0(r.EndDate), PaidAt: tsz(r.PaidAt),
					Commissions: r.Commissions, Claims: r.Claims, Total: r.Commissions + r.Claims, Cups: r.Cups, Orders: r.Orders,
					Approved: int(r.CommissionsApproved + r.ClaimsApproved), Pending: int(r.Pending),
				}
			}
			return out, nil
		})

	route(api, op("getMyPayslip", http.MethodGet, "/payouts/{id}", "One of the caller's payouts, in full"), sellerAccess,
		func(ctx context.Context, in *contract.PayoutInput) (*contract.PayslipOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			return payslip(ctx, d, caller, in.ID, caller.UserID)
		})

	route(api, op("getMyWorkDays", http.MethodGet, "/work-days", "The days the caller held a store"), sellerAccess,
		func(ctx context.Context, in *contract.MyWorkDaysInput) (*contract.MyWorkDaysOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			from, to, err := dateRange(in.From, in.To)
			if err != nil {
				return nil, err
			}
			days, err := workDays(ctx, d.Queries, caller, from, to)
			if err != nil {
				return nil, err
			}
			out := &contract.MyWorkDaysOutput{}
			out.Body.Days = days
			return out, nil
		})

	route(api, op("listMyClaims", http.MethodGet, "/claims", "The caller's claims in a range of days"), sellerAccess,
		func(ctx context.Context, in *contract.MyClaimsInput) (*contract.MyClaimsOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			from, to, err := dateRange(in.From, in.To)
			if err != nil {
				return nil, err
			}
			rows, err := d.Queries.ListMyClaims(ctx, store.ListMyClaimsParams{TenantID: caller.TenantID, UserID: caller.UserID, FromDate: from, ToDate: to})
			if err != nil {
				return nil, err
			}
			out := &contract.MyClaimsOutput{}
			out.Body.Claims = make([]contract.MyClaim, len(rows))
			for i, r := range rows {
				out.Body.Claims[i] = contract.MyClaim{ID: r.ID.String(), Date: day0(r.Date), Type: r.Type, Amount: r.Amount, Status: r.Status}
			}
			return out, nil
		})

	route(api, op("listMyClaimTypes", http.MethodGet, "/claim-types", "What the caller may claim this period, and the days they worked"), sellerAccess,
		func(ctx context.Context, _ *contract.TenantInput) (*contract.MyClaimTypesOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			frequency, err := d.Queries.GetPayFrequency(ctx, caller.TenantID)
			if err != nil {
				return nil, err
			}
			today := wibToday()
			start, end, err := domain.PayWindow(today, frequency)
			if err != nil {
				return nil, err
			}
			rows, err := d.Queries.MyClaimTypes(ctx, store.MyClaimTypesParams{
				TenantID: caller.TenantID, UserID: caller.UserID, StartDate: date(start), EndDate: date(end), Today: date(today),
			})
			if err != nil {
				return nil, err
			}
			days, err := workDays(ctx, d.Queries, caller, date(start), date(end))
			if err != nil {
				return nil, err
			}
			out := &contract.MyClaimTypesOutput{}
			out.Body.WorkDates = days
			out.Body.Types = make([]contract.MyClaimType, len(rows))
			for i, r := range rows {
				out.Body.Types[i] = contract.MyClaimType{
					ID: r.ID.String(), Name: r.Name, Frequency: r.Frequency, Amount: int64(r.Amount), Source: r.ClaimSource, Claimable: r.Claimable,
				}
			}
			return out, nil
		})

	route(api, op("createMyClaim", http.MethodPost, "/claims", "Submit a claim; its amount is the type's"), sellerWrite,
		func(ctx context.Context, in *contract.CreateMyClaimInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			q := idem.Queries(ctx, d.Queries)
			day, err := time.Parse(time.DateOnly, in.Body.Date)
			if err != nil {
				return nil, errClaimTooOld
			}
			today := wibToday()
			if day.Before(today.AddDate(0, 0, -claimWindow)) || day.After(today) {
				return nil, errClaimTooOld
			}
			status, err := q.PayoutStatusOn(ctx, store.PayoutStatusOnParams{TenantID: caller.TenantID, UserID: caller.UserID, Date: date(day)})
			if err != nil {
				return nil, err
			}
			if status == "paid" || status == "skipped" {
				return nil, errPeriodClosed
			}
			typeID, err := uuid(in.Body.TypeID, errClaimNotEligible)
			if err != nil {
				return nil, err
			}
			config, err := q.ClaimableConfig(ctx, store.ClaimableConfigParams{ID: typeID, UserID: caller.UserID, TenantID: caller.TenantID})
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errClaimNotEligible
			}
			if err != nil {
				return nil, err
			}
			if from, to, limited := claimPeriod(config.Frequency, day); limited {
				done, err := q.ClaimExists(ctx, store.ClaimExistsParams{TenantID: caller.TenantID, UserID: caller.UserID, ConfigID: typeID, FromDate: date(from), ToDate: date(to)})
				if err != nil {
					return nil, err
				}
				if done {
					return nil, errClaimDone
				}
			}
			if config.Frequency == "weekly" {
				worked, err := workDays(ctx, q, caller, date(day), date(day))
				if err != nil {
					return nil, err
				}
				if len(worked) == 0 {
					return nil, errNoWorkThatDay
				}
			}
			if in.Body.PhotoURL != "" && !strings.HasPrefix(files.PathIn(files.Purposes["reimbursement"].Bucket, in.Body.PhotoURL), caller.TenantID.String()+"/") {
				return nil, errBadReceipt
			}
			var storeID pgtype.UUID
			if in.Body.StoreID != "" {
				if storeID, err = assignedStore(ctx, q, caller, in.Body.StoreID); err != nil {
					return nil, err
				}
			}
			id, err := q.CreateClaim(ctx, store.CreateClaimParams{
				TenantID: caller.TenantID, UserID: caller.UserID, StoreID: storeID, ConfigID: typeID, Frequency: pgtype.Text{String: config.Frequency, Valid: true},
				Amount: numeric(config.Amount), Date: date(day),
				Notes:    pgtype.Text{String: in.Body.Notes, Valid: in.Body.Notes != ""},
				PhotoUrl: pgtype.Text{String: in.Body.PhotoURL, Valid: in.Body.PhotoURL != ""},
			})
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errClaimDone
			}
			if err != nil {
				return nil, err
			}
			if err := logActivity(ctx, q, caller, storeID, "claim_submitted", id, "payroll_claims", map[string]any{
				"claim_config_id": typeID.String(), "amount": config.Amount, "date": in.Body.Date,
			}); err != nil {
				return nil, err
			}
			return nil, ensurePayouts(ctx, q, caller.TenantID, []pgtype.UUID{caller.UserID}, day)
		})
}

// claimPeriod is the days a claim type allows one in; daily is left to the table's unique index.
func claimPeriod(frequency string, day time.Time) (from, to time.Time, limited bool) {
	switch frequency {
	case "weekly":
		from, to, _ = domain.PayWindow(day, "weekly")
		return from, to, true
	case "monthly":
		from = time.Date(day.Year(), day.Month(), 1, 0, 0, 0, 0, time.UTC)
		return from, from.AddDate(0, 1, -1), true
	case "one_time":
		return time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC), time.Date(2100, 1, 1, 0, 0, 0, 0, time.UTC), true
	}
	return from, to, false
}

func workDays(ctx context.Context, q *store.Queries, caller auth.Caller, from, to pgtype.Date) ([]string, error) {
	rows, err := q.MyWorkDays(ctx, store.MyWorkDaysParams{UserID: caller.UserID, TenantID: caller.TenantID, FromDate: from, ToDate: to})
	if err != nil {
		return nil, err
	}
	days := make([]string, len(rows))
	for i, r := range rows {
		days[i] = day0(r)
	}
	return days, nil
}
