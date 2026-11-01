# Task 055 — A CI/CD pipeline that fails well

**Status: step 1 in review, owner took the recommendations 2026-11-01. No PR without showing the owner the analysis first; each step is checked locally as far as it can be, and says what could not be.**

RFC: https://app.notion.com/p/40b95a715405812bb245f7604c06d8ae (the problems, the mock-ups, the issues found, the decisions).

## Build order

One PR each, shipped alone, watched on staging.

1. `pr.yml` and the new comments: one comment per stage, first line is the answer, a failure says what broke and what to do next
2. E2E on the PR
3. The plan as a tested script, deploys that catch up, the deploy button
4. The deploy check on PRs, after a small experiment
5. The simpler benchmark comment, with the seller app; look into why reopens loaded from the network
6. Release PRs read staging's result
7. Slack with Step 43, skipping slow jobs on docs-only PRs
