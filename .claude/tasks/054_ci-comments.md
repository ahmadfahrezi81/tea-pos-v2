# Task 054 — Every CI result says what happened, in the PR

**Status: in review.** Owner: the comment is the interface, a failure should not mean opening the runner.

- **A failed job names its step and shows its last log lines, open in the comment** (`.github/scripts/failures.mjs`): Checks, Preview, Security, a failed deploy
- **Workflows that said nothing now report, passed or failed:** Security and Release source; Migrations and Preview also report when they fail; the Railway plan when it fails
- **End-to-end comments show why a test failed,** not only its name
- **A failed deploy posts a new comment,** because editing the live one notifies nobody; a failed plan step, which never reached the comment, posts one too
