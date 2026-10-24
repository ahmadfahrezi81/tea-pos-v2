# Overnight log — Steps 20-24 (2026-10-25)

The owner asked for the backoffice to be built overnight, merged to staging when green, never to production; every judgement call is written here with its reason, newest last.

## Step 20 — Pay setup

- **No review of task files tonight:** each is written first and committed with its code; the owner reviews them in the morning
- **The Pay tab's totals come from Go** (`GET /pay/period`), the same sums v1's screen makes from the period's payouts, so the tab works before Step 23 builds the payouts screens
- **Staff list in one read:** users with their commission type and bank details joined in SQL; v1 makes three requests and joins them on the phone
- **Eligibility saved per claim type** (`PUT /pay/claim-types/{id}/eligible` with the full list of users), in one transaction; v1 sends one request per staff member changed, each replacing that person's whole set
- **Kept as v1:** no uniqueness on slugs (v1 has none; adding a constraint is a data model change, after cutover); a claim type's amount and source cannot be changed after creation (v1's edit screen shows them read-only); config changes write no activity log (v1 writes none)
- **Backoffice budget 135 → 137 KB:** the first screen's own code did not grow; the Pay screens share Link and React helpers with it, so the build split those into small shared files, each with its own compression overhead (+1.3 KB). Tuning the split (Rolldown's chunking options) is a separate task for the morning, not something to try blind overnight

## Steps 21 and 22 — the payslip: commissions, the day review, claims

- **Built as one step and one PR:** in v1 the day review (Step 21) and claim decisions (Step 22) are the same screen, the payslip, reached from Staff Payouts; splitting them would build that screen twice. Step 23 (settling a payout) stays its own
- **The payouts list and the payslip are read in Go,** each in one request (v1: the list joins users and pay info on the phone; the payslip makes three requests)
- **Every decision keeps v1's rules:** a decision on a settled (paid or skipped) payout's day is refused; a whole day decides only its still-pending rows, so a double tap never overturns a decision; each decision writes the same activity log entries as v1 (`payroll_commission_updated`, `claim_status_updated`; a day: one entry per table with its count)
