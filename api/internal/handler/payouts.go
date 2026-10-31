package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/auth"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/contract"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/domain"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/files"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/idem"
	"github.com/ahmadfahrezi81/tea-pos-v2/api/internal/store"
)

func registerPayouts(api huma.API, d Deps) {
	op := func(id, method, path, summary string) huma.Operation {
		return huma.Operation{OperationID: id, Method: method, Path: "/tenants/{tenant}/pay" + path, Summary: summary, Tags: []string{"pay"}}
	}

	route(api, op("getPayslip", http.MethodGet, "/payouts/{id}", "A payout with every commission and claim in it"), payAccess,
		func(ctx context.Context, in *contract.PayoutInput) (*contract.PayslipOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			id, err := uuid(in.ID, errPayoutNotFound)
			if err != nil {
				return nil, err
			}
			p, err := d.Queries.GetPayout(ctx, store.GetPayoutParams{ID: id, TenantID: caller.TenantID})
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errPayoutNotFound
			}
			if err != nil {
				return nil, err
			}
			var (
				wg   sync.WaitGroup
				cms  []store.ListPayoutCommissionsRow
				cls  []store.ListPayoutClaimsRow
				errs [2]error
			)
			wg.Go(func() {
				cms, errs[0] = d.Queries.ListPayoutCommissions(ctx, store.ListPayoutCommissionsParams{PayoutID: id, TenantID: caller.TenantID, UserID: p.UserID})
			})
			wg.Go(func() {
				cls, errs[1] = d.Queries.ListPayoutClaims(ctx, store.ListPayoutClaimsParams{PayoutID: id, TenantID: caller.TenantID, UserID: p.UserID})
			})
			wg.Wait()
			if err := errors.Join(errs[:]...); err != nil {
				return nil, err
			}
			s := contract.Payslip{
				Payout: contract.Payout{
					ID: p.ID.String(), UserID: p.UserID.String(), Name: p.FullName, AvatarURL: p.AvatarUrl.String,
					Status: p.Status, Start: day0(p.StartDate), End: day0(p.EndDate), PaidAt: tsz(p.PaidAt),
				},
				Notes: p.Notes.String, PaidBy: p.PaidBy.String,
				Commissions: make([]contract.PayslipCommission, len(cms)), Claims: make([]contract.PayslipClaim, len(cls)),
			}
			// The payslip's totals are its approved rows, as the old app's.
			for i, c := range cms {
				s.Commissions[i] = contract.PayslipCommission{
					ID: c.ID.String(), Date: day0(c.Date), Status: c.Status, StoreName: c.StoreName.String,
					Cups: int64(c.TotalCups), Orders: int64(c.TotalOrders), RatePerCup: c.RatePerCup, Amount: c.TotalCommission,
				}
				if c.Status == "approved" {
					s.Payout.Commissions += c.TotalCommission
					s.Cups += int64(c.TotalCups)
					s.Orders += int64(c.TotalOrders)
					s.Approved++
				}
				if c.Status == "pending" {
					s.Pending++
				}
			}
			if len(cms) > 0 {
				s.RatePerCup = cms[0].RatePerCup
			}
			for i, c := range cls {
				s.Claims[i] = contract.PayslipClaim{
					ID: c.ID.String(), Date: day0(c.Date), Status: c.Status, Type: c.ClaimType.String, Amount: c.Amount,
					Notes: c.Notes.String, HoursWorked: num(c.HoursWorked), ThresholdHours: num(c.ThresholdHours),
				}
				if c.Status == "approved" {
					s.Payout.Claims += c.Amount
					s.Approved++
				}
				if c.Status == "pending" {
					s.Pending++
				}
			}
			s.Total = s.Payout.Commissions + s.Payout.Claims
			if p.PaymentProofUrl.Valid {
				bucket := files.Purposes["payroll_proof"].Bucket
				if path := files.PathIn(bucket, p.PaymentProofUrl.String); path != "" {
					if signed, err := d.Files.SignReads(ctx, bucket, []string{path}, photoTTL); err == nil {
						s.PaymentProofURL = signed[path]
					}
				}
			}
			return &contract.PayslipOutput{Body: s}, nil
		})

	route(api, op("decideCommission", http.MethodPut, "/commissions/{id}", "Approve or reject one commission"), payWrite,
		func(ctx context.Context, in *contract.DecisionInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			id, err := uuid(in.ID, errCommissionNotFound)
			if err != nil {
				return nil, err
			}
			ref, err := d.Queries.GetCommissionRef(ctx, store.GetCommissionRefParams{ID: id, TenantID: caller.TenantID})
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errCommissionNotFound
			}
			if err != nil {
				return nil, err
			}
			if err := openForDecisions(ctx, d.Queries, caller.TenantID, ref.UserID, ref.Date); err != nil {
				return nil, err
			}
			q := idem.Queries(ctx, d.Queries)
			if err := q.SetCommissionStatus(ctx, store.SetCommissionStatusParams{ID: id, TenantID: caller.TenantID, Status: in.Body.Status}); err != nil {
				return nil, err
			}
			return nil, logActivity(ctx, q, caller, ref.StoreID, "payroll_commission_updated", id, "payroll_commissions", map[string]any{"status": in.Body.Status})
		})

	route(api, op("decideClaim", http.MethodPut, "/claims/{id}", "Approve or reject one claim"), payWrite,
		func(ctx context.Context, in *contract.DecisionInput) (*struct{}, error) {
			caller, _ := auth.CallerFrom(ctx)
			id, err := uuid(in.ID, errClaimNotFound)
			if err != nil {
				return nil, err
			}
			ref, err := d.Queries.GetClaimRef(ctx, store.GetClaimRefParams{ID: id, TenantID: caller.TenantID})
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errClaimNotFound
			}
			if err != nil {
				return nil, err
			}
			if err := openForDecisions(ctx, d.Queries, caller.TenantID, ref.UserID, ref.Date); err != nil {
				return nil, err
			}
			q := idem.Queries(ctx, d.Queries)
			if err := q.SetClaimStatus(ctx, store.SetClaimStatusParams{ID: id, TenantID: caller.TenantID, Status: in.Body.Status}); err != nil {
				return nil, err
			}
			return nil, logActivity(ctx, q, caller, pgtype.UUID{}, "claim_status_updated", id, "payroll_claims", map[string]any{"status": in.Body.Status})
		})

	route(api, op("reviewDay", http.MethodPost, "/payouts/{id}/days/{date}/review", "Approve or reject every still-pending commission and claim of a payout's day"), payWrite,
		func(ctx context.Context, in *contract.ReviewDayInput) (*contract.ReviewDayOutput, error) {
			caller, _ := auth.CallerFrom(ctx)
			id, err := uuid(in.ID, errPayoutNotFound)
			if err != nil {
				return nil, err
			}
			p, err := d.Queries.GetPayout(ctx, store.GetPayoutParams{ID: id, TenantID: caller.TenantID})
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errPayoutNotFound
			}
			if err != nil {
				return nil, err
			}
			t, err := time.Parse(time.DateOnly, in.Date)
			if err != nil || t.Before(p.StartDate.Time) || t.After(p.EndDate.Time) {
				return nil, errDayNotInPayout
			}
			if err := openForDecisions(ctx, d.Queries, caller.TenantID, p.UserID, date(t)); err != nil {
				return nil, err
			}
			q := idem.Queries(ctx, d.Queries)
			args := func() (pgtype.UUID, pgtype.UUID, pgtype.Date, string) {
				return caller.TenantID, p.UserID, date(t), in.Body.Status
			}
			tn, user, day, status := args()
			cms, err := q.ReviewDayCommissions(ctx, store.ReviewDayCommissionsParams{TenantID: tn, UserID: user, Date: day, Status: status})
			if err != nil {
				return nil, err
			}
			cls, err := q.ReviewDayClaims(ctx, store.ReviewDayClaimsParams{TenantID: tn, UserID: user, Date: day, Status: status})
			if err != nil {
				return nil, err
			}
			// One entry per table with its count, as the old app: the decision was the day, once.
			meta := map[string]any{"status": status, "date": in.Date, "bulk": true}
			if cms > 0 {
				meta["count"] = cms
				if err := logActivity(ctx, q, caller, pgtype.UUID{}, "payroll_commission_updated", pgtype.UUID{}, "payroll_commissions", meta); err != nil {
					return nil, err
				}
			}
			if cls > 0 {
				meta["count"] = cls
				if err := logActivity(ctx, q, caller, pgtype.UUID{}, "claim_status_updated", pgtype.UUID{}, "payroll_claims", meta); err != nil {
					return nil, err
				}
			}
			out := &contract.ReviewDayOutput{}
			out.Body.Commissions, out.Body.Claims = cms, cls
			return out, nil
		})
}

func registerSettle(api huma.API, d Deps) {
	route(api, huma.Operation{
		OperationID: "settlePayout", Method: http.MethodPost, Path: "/tenants/{tenant}/pay/payouts/{id}/settle",
		Summary: "Pay a payout (with the transfer screenshot) or skip it (nothing owed)", Tags: []string{"pay"},
	}, payWrite, func(ctx context.Context, in *contract.SettlePayoutInput) (*struct{}, error) {
		caller, _ := auth.CallerFrom(ctx)
		id, err := uuid(in.ID, errPayoutNotFound)
		if err != nil {
			return nil, err
		}
		p, err := d.Queries.GetPayout(ctx, store.GetPayoutParams{ID: id, TenantID: caller.TenantID})
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errPayoutNotFound
		}
		if err != nil {
			return nil, err
		}
		if p.Status != "pending" {
			return nil, errPayoutSettled
		}
		// From the period's own last day (stores close that night and pay straight after), as the old app.
		if time.Now().In(domain.WIB).Format(time.DateOnly) < day0(p.EndDate) {
			return nil, errPayoutNotDue
		}
		pending, err := d.Queries.CountPayoutPending(ctx, store.CountPayoutPendingParams{ID: id, TenantID: caller.TenantID})
		if err != nil {
			return nil, err
		}
		if pending > 0 {
			return nil, errPayoutPendingReview
		}
		proof := pgtype.Text{}
		if in.Body.PaymentProofURL != "" {
			// Only a screenshot uploaded for this tenant's payroll proofs.
			path := files.PathIn(files.Purposes["payroll_proof"].Bucket, in.Body.PaymentProofURL)
			if !strings.HasPrefix(path, caller.TenantID.String()+"/") {
				return nil, errBadProof
			}
			proof = pgtype.Text{String: in.Body.PaymentProofURL, Valid: true}
		}
		if in.Body.Status == "paid" && !proof.Valid {
			return nil, errProofRequired
		}
		q := idem.Queries(ctx, d.Queries)
		n, err := q.SettlePayout(ctx, store.SettlePayoutParams{
			ID: id, TenantID: caller.TenantID, Status: in.Body.Status, PaidBy: caller.UserID,
			PaymentProofUrl: proof, Notes: pgtype.Text{String: in.Body.Notes, Valid: in.Body.Notes != ""},
		})
		if err != nil {
			return nil, err
		}
		if n == 0 {
			return nil, errPayoutSettled // settled a moment ago, elsewhere
		}
		return nil, logActivity(ctx, q, caller, pgtype.UUID{}, "payroll_payout_updated", id, "payroll_payouts", map[string]any{"status": in.Body.Status})
	})
}

// openForDecisions refuses a decision on a day whose payout is settled (paid or skipped): its
// numbers are history, as the old app's assertPayoutNotPaid.
func openForDecisions(ctx context.Context, q *store.Queries, tenant, user pgtype.UUID, day pgtype.Date) error {
	status, err := q.PayoutStatusOn(ctx, store.PayoutStatusOnParams{TenantID: tenant, UserID: user, Date: day})
	if err != nil {
		return err
	}
	if status == "paid" || status == "skipped" {
		return errPayoutSettled
	}
	return nil
}

func logActivity(ctx context.Context, q *store.Queries, caller auth.Caller, storeID pgtype.UUID, kind string, ref pgtype.UUID, table string, meta map[string]any) error {
	b, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	return q.LogActivity(ctx, store.LogActivityParams{
		TenantID: caller.TenantID, UserID: caller.UserID, StoreID: storeID, Type: kind,
		RefID: ref, RefTable: pgtype.Text{String: table, Valid: table != ""}, Metadata: b,
	})
}

func day0(d pgtype.Date) string { return d.Time.Format(time.DateOnly) }

func tsz(t pgtype.Timestamptz) string {
	if !t.Valid {
		return ""
	}
	return t.Time.UTC().Format(time.RFC3339)
}

func num(n pgtype.Numeric) *float64 {
	f, err := n.Float64Value()
	if err != nil || !f.Valid {
		return nil
	}
	return &f.Float64
}
