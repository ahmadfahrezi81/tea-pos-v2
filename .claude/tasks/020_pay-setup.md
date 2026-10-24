# Task 020 — Pay setup: the Pay tab, staff, commission and claim types, the pay schedule

**Status: built 2026-10-25 overnight, merged to staging when green (owner, 2026-10-25: build Steps 20-24 without review; decisions in `overnight-log.md`). Checked: unit tests for the pay windows (each against v1's own function's output); integration tests for every endpoint (a write sent twice saved once, another tenant's user and a switched-off type refused, eligibility replaced whole, the period's totals with a non-seller left out); typecheck, lint, bundle.**

## The goal

v1 backoffice's Pay tab and its settings, one-to-one in look: the current period's totals, the staff list and each person's pay info, commission types, staff commissions, claim types with who may claim them, and the pay schedule. Every setting that decides what people are paid, written through Go.
RFC: Build order Step 20.

## The plan

1. **The pay calendar in Go** (`internal/domain/pay.go`, unit tested): v1's rule, exactly: periods of 1, 2 or 4 weeks, Monday to Sunday, multi-week periods counted in fixed blocks from Monday 6 Jan 2025; the payout is the day after a period ends
2. **Endpoints** (ADMIN, in the tenant; writes Idempotent):
   - `GET /pay/period`: the current period (start, end, frequency) and its totals over selling staff, as v1's Pay tab sums the period's payouts (approved commissions and claims, approved and pending counts); non-sellers (commission type `SELLER_0` or rate 0) left out, as v1
   - `GET /pay/staff`: the tenant's users, each with their commission type and bank details, in one read (v1: three)
   - `GET|POST /pay/commission-types`, `PATCH /pay/commission-types/{id}`
   - `PUT /pay/staff/{userId}/commission-type`: assigns one, or none
   - `GET|POST /pay/claim-types`, `PATCH /pay/claim-types/{id}`, `PUT /pay/claim-types/{id}/eligible`: who may claim it, one write (v1: one per staff member changed)
   - `PUT /pay/schedule`: the tenant's pay frequency
3. **Screens**, routes under `pay/`: the Pay tab (period card, Operations, Configuration), `staff`, `staff/<userId>`, `commission-types` (+ add, edit), `staff-commissions` (+ `<userId>`), `claim-types` (+ add, edit with eligibility), `pay-schedule`; v1's list rows, fields, number input, switch and save footer with its confirm sheet as shared components
4. **Tests:** unit: the pay window for each frequency, across the epoch and year ends. Integration: every endpoint, another tenant refused, a seller refused, a write sent twice saved once

## Not in this task

- Staff Payouts (the list and a payslip): Step 23; its row on the Pay tab opens a coming-soon screen until then
- Day review and approving commissions: Step 21; claims: Step 22
