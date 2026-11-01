# Task 055 — A CI/CD pipeline that fails well

**Status: done, released in 2026.11.2 (2026-11-01). Steps 1-7, in #83, #85, #86, #88, #89, #91, #92. No Slack: the owner gets everything through the GitHub app.**

RFC: https://app.notion.com/p/40b95a715405812bb245f7604c06d8ae (the problems, the mock-ups, the issues found, the decisions).

## Build order

One PR each, shipped alone, watched on staging.

1. `pr.yml` and the new comments: one comment per stage, first line is the answer, a failure says what broke and what to do next
2. E2E on the PR
3. The plan as a tested script, deploys that catch up, the deploy button (no commit picker: docs/runbook.md rolls back)
4. The deploy check on PRs, after a small experiment
5. The simpler benchmark comment, with the seller app; look into why reopens loaded from the network
6. Release PRs read staging's result
7. Skipping slow jobs on docs-only PRs

## Experiment, 2026-11-01 (#87, closed)

A job guarded with `if` is still validated at start: a called workflow asking for more than the caller grants gives `startup_failure`, with the correct one skipped. **That run does not appear in the PR's checks**, only on the Actions page and through `GET /actions/runs?head_sha=`, whose answer has no reason in it. So a job in `pr.yml` has to read that result for it to show on the PR.
