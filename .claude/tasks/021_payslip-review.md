# Task 021 — Staff Payouts and the payslip: commissions, the day review, claims (Steps 21 and 22)

**Status: built 2026-10-25 overnight, merged to staging when green (decisions in `overnight-log.md`). Checked: integration test over the list and payslip (the same totals, from approved rows only), a day review deciding only pending rows (a second review overturns nothing), single decisions with their activity log entries, every decision on a paid payout refused, another tenant's payout not found; typecheck, lint, bundle (backoffice 135.9 of 137 KB).**

## The goal

v1 backoffice's Staff Payouts list and a person's payslip, one-to-one in look, with every decision v1 makes there: approve or reject one commission, one claim, or a whole day.
RFC: Build order Steps 21 (commissions and the day review) and 22 (claims), built together: v1 does both on the payslip.

## The plan

1. **Endpoints** (ADMIN, in the tenant; writes Idempotent):
   - `GET /pay/payouts?month=`: the payouts overlapping the month, each with its person, totals summed from approved rows (commissions, claims, cups, orders), approved and pending counts, and whether the person is a seller
   - `GET /pay/payouts/{id}`: the payslip: the payout, its commissions (with store) and claims (with type), totals, the rate per cup, who paid it; a payment proof as a signed address
   - `PUT /pay/commissions/{id}` and `PUT /pay/claims/{id}` `{status}`: one decision
   - `POST /pay/payouts/{id}/days/{date}/review` `{status}`: every still-pending commission and claim of that person on that day
   - Each refused when the payout of that day is settled (paid or skipped), as v1's `assertPayoutNotPaid`; each writes v1's activity log entry
2. **Screens:** `pay/payouts` (next payout, month, search, filter sheet: status and non-sellers; ongoing first, then done) and `pay/payouts/<id>` (pending-days warning, totals, payment details, work days calendar, the daily breakdown with ✓ ✗ per row and Approve all / Reject all per day, the confirm sheet; the Pay button opens Step 23)
3. **Tests:** integration: the list's totals match the payslip's; a day review touches only pending rows; every decision on a settled payout refused; another tenant's rows refused

## Not in this task

- Paying or skipping a payout: Step 23
