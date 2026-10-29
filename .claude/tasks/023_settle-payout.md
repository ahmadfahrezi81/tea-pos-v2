# Task 023 — Paying a payout, and checking it against v1

**Status: built 2026-10-25 overnight, merged to staging when green (decisions in `overnight-log.md`). Checked: integration test (paid needs a screenshot uploaded for this tenant, a pending claim or an unfinished period refused, settling twice refused, the activity log written); v2's pay windows equal v1's for every day of Dec 2024-2027 and each frequency (3,378 windows); v2's payout totals equal v1's arithmetic over every payout on staging (13).**

## The goal

v1 backoffice's Confirm Payout screen, one-to-one in look: the amount and bank details to copy, the transfer screenshot, a note for the staff member; or, with nothing owed, closing the period as skipped. And the RFC's check that payouts come out the same as v1's.
RFC: Build order Step 23.

## The plan

1. **`POST /pay/payouts/{id}/settle`** `{status: paid | skipped, paymentProofUrl?, notes?}` (ADMIN, Idempotent), as v1's `updatePayoutStatus`: refused when already settled, when anything is still pending, and when the period has not reached its last day; `paid_at` and `paid_by` written for a skip too; v1's activity log entry
2. **Screen** `pay/payouts/<id>/pay`: v1's, with the screenshot through 17c (`payroll_proof`, private): from the gallery and not cropped, unlike camera photos
3. **Against v1:** the pay calendar compared day by day with v1's own function, and every payout's totals on staging compared with v1's arithmetic

## Not in this task

- The seller's side of a payout (their earnings and payslip): Step 33
