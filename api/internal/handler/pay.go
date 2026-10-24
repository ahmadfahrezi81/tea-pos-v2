package handler

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/idem"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

// payAccess is the Pay tab's: admins, in their tenant. payWrite is the same for writes, each
// saved once per Idempotency-Key.
var (
	payAccess = auth.Roles("ADMIN").InTenant()
	payWrite  = auth.Roles("ADMIN").InTenant().Idempotent()
)

func registerPay(api huma.API, d Deps) {
	op := func(id, method, path, summary string) huma.Operation {
		return huma.Operation{OperationID: id, Method: method, Path: "/tenants/{tenant}/pay" + path, Summary: summary, Tags: []string{"pay"}}
	}

	route(api, op("getPayPeriod", http.MethodGet, "/period", "The current pay period and what it owes the selling staff"), payAccess,
		func(ctx context.Context, _ *contract.TenantInput) (*contract.PayPeriodOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			frequency, err := d.Queries.GetPayFrequency(ctx, caller.TenantID)
			if err != nil {
				return nil, err
			}
			start, end, err := domain.PayWindow(time.Now().In(domain.WIB), frequency)
			if err != nil {
				return nil, err
			}
			p := store.PayPeriodTotalsParams{TenantID: caller.TenantID, StartDate: date(start), EndDate: date(end)}
			totals, err := d.Queries.PayPeriodTotals(ctx, p)
			if err != nil {
				return nil, err
			}
			all, err := d.Queries.CountPeriodPayouts(ctx, store.CountPeriodPayoutsParams{TenantID: caller.TenantID, StartDate: date(start)})
			if err != nil {
				return nil, err
			}
			return &contract.PayPeriodOutput{Body: contract.PayPeriod{
				Frequency: frequency, Start: start.Format(time.DateOnly), End: end.Format(time.DateOnly),
				PayoutDate: domain.PayoutDate(end).Format(time.DateOnly), Payouts: int(all),
				Commissions: totals.Commissions, Claims: totals.Claims, Total: totals.Commissions + totals.Claims,
				Approved: int(totals.Approved), Reviewed: int(totals.Approved + totals.Pending),
			}}, nil
		})

	route(api, op("setPaySchedule", http.MethodPut, "/schedule", "Set the tenant's pay frequency, for every staff member"), payWrite,
		func(ctx context.Context, in *contract.SetPayScheduleInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			return nil, idem.Queries(ctx, d.Queries).SetPayFrequency(ctx, store.SetPayFrequencyParams{TenantID: caller.TenantID, PayFrequency: in.Body.Frequency})
		})

	route(api, op("listPayStaff", http.MethodGet, "/staff", "The tenant's users with their commission type and bank details"), payAccess,
		func(ctx context.Context, _ *contract.TenantInput) (*contract.PayStaffOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			rows, err := d.Queries.ListPayStaff(ctx, caller.TenantID)
			if err != nil {
				return nil, err
			}
			out := &contract.PayStaffOutput{}
			out.Body.Staff = make([]contract.PayStaff, len(rows))
			for i, r := range rows {
				s := contract.PayStaff{
					ID: r.ID.String(), Name: r.FullName, Email: r.Email, AvatarURL: r.AvatarUrl.String,
					Role: r.Role, Status: r.Status,
					Bank: contract.Bank{Name: r.BankName.String, AccountNumber: r.BankAccountNumber.String, AccountHolder: r.BankAccountHolder.String},
				}
				if r.CommissionConfigID.Valid {
					s.CommissionType = &contract.CommissionType{
						ID: r.CommissionConfigID.String(), Name: r.CommissionName.String, Slug: r.CommissionSlug.String,
						Enabled: true, RatePerCup: int64(r.RatePerCup.Int32),
					}
				}
				out.Body.Staff[i] = s
			}
			return out, nil
		})

	route(api, op("setStaffCommission", http.MethodPut, "/staff/{userId}/commission-type", "Give a staff member a commission type, or none"), payWrite,
		func(ctx context.Context, in *contract.SetStaffCommissionInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			user, err := uuid(in.UserID, errStaffNotFound)
			if err != nil {
				return nil, err
			}
			if ok, err := d.Queries.UserInTenant(ctx, store.UserInTenantParams{TenantID: caller.TenantID, UserID: user}); err != nil || !ok {
				return nil, orErr(err, errStaffNotFound)
			}
			var typeID pgtype.UUID
			if in.Body.CommissionTypeID != nil {
				if typeID, err = uuid(*in.Body.CommissionTypeID, errCommissionTypeNotFound); err != nil {
					return nil, err
				}
				if ok, err := d.Queries.CommissionTypeUsable(ctx, store.CommissionTypeUsableParams{ID: typeID, TenantID: caller.TenantID}); err != nil || !ok {
					return nil, orErr(err, errCommissionTypeNotFound)
				}
			}
			return nil, idem.Queries(ctx, d.Queries).SetUserCommissionType(ctx, store.SetUserCommissionTypeParams{
				TenantID: caller.TenantID, UserID: user, CommissionConfigID: typeID,
			})
		})

	route(api, op("listCommissionTypes", http.MethodGet, "/commission-types", "The tenant's commission types, by name"), payAccess,
		func(ctx context.Context, _ *contract.TenantInput) (*contract.CommissionTypesOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			rows, err := d.Queries.ListCommissionTypes(ctx, caller.TenantID)
			if err != nil {
				return nil, err
			}
			out := &contract.CommissionTypesOutput{}
			out.Body.Types = make([]contract.CommissionType, len(rows))
			for i, r := range rows {
				out.Body.Types[i] = commissionType(r.ID, r.Name, r.Slug, r.IsEnabled, r.RatePerCup)
			}
			return out, nil
		})

	route(api, op("createCommissionType", http.MethodPost, "/commission-types", "Add a commission type"), payWrite,
		func(ctx context.Context, in *contract.CreateCommissionTypeInput) (*contract.CommissionTypeOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			r, err := idem.Queries(ctx, d.Queries).CreateCommissionType(ctx, store.CreateCommissionTypeParams{
				TenantID: caller.TenantID, Name: in.Body.Name, Slug: in.Body.Slug, RatePerCup: int32(in.Body.RatePerCup),
			})
			if err != nil {
				return nil, err
			}
			return &contract.CommissionTypeOutput{Body: commissionType(r.ID, r.Name, r.Slug, r.IsEnabled, r.RatePerCup)}, nil
		})

	route(api, op("updateCommissionType", http.MethodPatch, "/commission-types/{id}", "Rename, switch off or re-rate a commission type"), payWrite,
		func(ctx context.Context, in *contract.UpdateCommissionTypeInput) (*contract.CommissionTypeOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			id, err := uuid(in.ID, errCommissionTypeNotFound)
			if err != nil {
				return nil, err
			}
			p := store.UpdateCommissionTypeParams{ID: id, TenantID: caller.TenantID}
			if in.Body.Name != nil {
				p.Name = pgtype.Text{String: *in.Body.Name, Valid: true}
			}
			if in.Body.Enabled != nil {
				p.IsEnabled = pgtype.Bool{Bool: *in.Body.Enabled, Valid: true}
			}
			if in.Body.RatePerCup != nil {
				p.RatePerCup = pgtype.Int4{Int32: int32(*in.Body.RatePerCup), Valid: true}
			}
			r, err := idem.Queries(ctx, d.Queries).UpdateCommissionType(ctx, p)
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errCommissionTypeNotFound
			}
			if err != nil {
				return nil, err
			}
			return &contract.CommissionTypeOutput{Body: commissionType(r.ID, r.Name, r.Slug, r.IsEnabled, r.RatePerCup)}, nil
		})

	route(api, op("listClaimTypes", http.MethodGet, "/claim-types", "The tenant's claim types, by name"), payAccess,
		func(ctx context.Context, _ *contract.TenantInput) (*contract.ClaimTypesOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			rows, err := d.Queries.ListClaimTypes(ctx, caller.TenantID)
			if err != nil {
				return nil, err
			}
			out := &contract.ClaimTypesOutput{}
			out.Body.Types = make([]contract.ClaimType, len(rows))
			for i, r := range rows {
				out.Body.Types[i] = claimType(store.CreateClaimTypeRow(r))
			}
			return out, nil
		})

	route(api, op("createClaimType", http.MethodPost, "/claim-types", "Add a claim type"), payWrite,
		func(ctx context.Context, in *contract.CreateClaimTypeInput) (*contract.ClaimTypeOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			b := in.Body
			p := store.CreateClaimTypeParams{
				TenantID: caller.TenantID, Name: b.Name, Slug: b.Slug, Frequency: b.Frequency,
				Amount: int32(b.Amount), ClaimSource: b.Source,
			}
			// Hours matter only to the claims the app makes itself; auto needs them (the table checks).
			if b.Source != "manual" && b.AutoThresholdHours != nil {
				if err := p.AutoThresholdHours.Scan(strconv.FormatFloat(*b.AutoThresholdHours, 'f', -1, 64)); err != nil {
					return nil, err
				}
			}
			if b.Source == "auto" && b.AutoThresholdHours == nil {
				return nil, errAutoNeedsHours
			}
			r, err := idem.Queries(ctx, d.Queries).CreateClaimType(ctx, p)
			if err != nil {
				return nil, err
			}
			return &contract.ClaimTypeOutput{Body: claimType(r)}, nil
		})

	route(api, op("updateClaimType", http.MethodPatch, "/claim-types/{id}", "Rename or switch off a claim type"), payWrite,
		func(ctx context.Context, in *contract.UpdateClaimTypeInput) (*contract.ClaimTypeOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			id, err := uuid(in.ID, errClaimTypeNotFound)
			if err != nil {
				return nil, err
			}
			p := store.UpdateClaimTypeParams{ID: id, TenantID: caller.TenantID}
			if in.Body.Name != nil {
				p.Name = pgtype.Text{String: *in.Body.Name, Valid: true}
			}
			if in.Body.Enabled != nil {
				p.IsEnabled = pgtype.Bool{Bool: *in.Body.Enabled, Valid: true}
			}
			r, err := idem.Queries(ctx, d.Queries).UpdateClaimType(ctx, p)
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errClaimTypeNotFound
			}
			if err != nil {
				return nil, err
			}
			return &contract.ClaimTypeOutput{Body: claimType(store.CreateClaimTypeRow(r))}, nil
		})

	route(api, op("listClaimEligible", http.MethodGet, "/claim-types/{id}/eligible", "Who may claim a claim type"), payAccess,
		func(ctx context.Context, in *contract.ClaimTypeIDInput) (*contract.ClaimEligibleOutput, error) {
			caller, id, err := ownClaimType(ctx, d.Queries, in.ID)
			if err != nil {
				return nil, err
			}
			users, err := d.Queries.ListClaimEligible(ctx, store.ListClaimEligibleParams{TenantID: caller.TenantID, ClaimConfigID: id})
			if err != nil {
				return nil, err
			}
			out := &contract.ClaimEligibleOutput{}
			out.Body.UserIDs = make([]string, len(users))
			for i, u := range users {
				out.Body.UserIDs[i] = u.String()
			}
			return out, nil
		})

	route(api, op("setClaimEligible", http.MethodPut, "/claim-types/{id}/eligible", "Set who may claim a claim type: everyone listed, no one else"), payWrite,
		func(ctx context.Context, in *contract.SetClaimEligibleInput) (*struct{}, error) {
			caller, id, err := ownClaimType(ctx, d.Queries, in.ID)
			if err != nil {
				return nil, err
			}
			users := make([]pgtype.UUID, len(in.Body.UserIDs))
			for i, s := range in.Body.UserIDs {
				if users[i], err = uuid(s, errStaffNotFound); err != nil {
					return nil, err
				}
			}
			n, err := d.Queries.CountUsersInTenant(ctx, store.CountUsersInTenantParams{TenantID: caller.TenantID, UserIds: users})
			if err != nil {
				return nil, err
			}
			if int(n) != len(uniq(in.Body.UserIDs)) {
				return nil, errStaffNotFound
			}
			// Both on the write's transaction: the set changes whole or not at all.
			q := idem.Queries(ctx, d.Queries)
			if err := q.RemoveClaimEligible(ctx, store.RemoveClaimEligibleParams{TenantID: caller.TenantID, ClaimConfigID: id, UserIds: users}); err != nil {
				return nil, err
			}
			return nil, q.AddClaimEligible(ctx, store.AddClaimEligibleParams{TenantID: caller.TenantID, ClaimConfigID: id, UserIds: users})
		})
}

func commissionType(id pgtype.UUID, name, slug string, enabled bool, rate int32) contract.CommissionType {
	return contract.CommissionType{ID: id.String(), Name: name, Slug: slug, Enabled: enabled, RatePerCup: int64(rate)}
}

func claimType(r store.CreateClaimTypeRow) contract.ClaimType {
	c := contract.ClaimType{
		ID: r.ID.String(), Name: r.Name, Slug: r.Slug, Frequency: r.Frequency, Enabled: r.IsEnabled,
		Amount: int64(r.Amount), Source: r.ClaimSource,
	}
	if f, err := r.AutoThresholdHours.Float64Value(); err == nil && f.Valid {
		c.AutoThresholdHours = &f.Float64
	}
	return c
}

func ownClaimType(ctx context.Context, q *store.Queries, s string) (auth.Caller, pgtype.UUID, error) {
	caller, _ := auth.CallerFrom(ctx)
	id, err := uuid(s, errClaimTypeNotFound)
	if err != nil {
		return caller, id, err
	}
	ok, err := q.ClaimTypeInTenant(ctx, store.ClaimTypeInTenantParams{ID: id, TenantID: caller.TenantID})
	if err == nil && !ok {
		err = errClaimTypeNotFound
	}
	return caller, id, err
}

func uuid(s string, notFound error) (pgtype.UUID, error) {
	var id pgtype.UUID
	if err := id.Scan(s); err != nil {
		return id, notFound
	}
	return id, nil
}

// orErr is err when there is one, else the answer for "no such thing".
func orErr(err, notFound error) error {
	if err != nil {
		return err
	}
	return notFound
}

func date(t time.Time) pgtype.Date {
	return pgtype.Date{Time: t, Valid: true}
}
