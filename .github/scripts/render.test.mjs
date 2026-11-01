import assert from "node:assert/strict";
import { test } from "node:test";

import { e2eSummary, prComment, render } from "./render.mjs";

const base = {
    title: "Deploy to staging",
    doneText: "Staging runs this commit",
    commit: "1233c765",
    run: "u",
    startedAt: 0,
    sections: {},
};

test("a passing deploy leads with the answer, hides skipped steps and folds the details", () => {
    const s = {
        ...base,
        steps: [
            { id: "config", name: "Railway config", state: "skipped", detail: "not changed" },
            { id: "api", name: "API", state: "success", detail: "93 s" },
            { id: "e2e", name: "End-to-end tests", state: "success", detail: "14 passed" },
        ],
        sections: { e2e: "Seller 2" },
    };
    const out = render(s, "<!-- m -->", 180000).replace(/<!-- state:.*\n/, "");
    assert.match(out, /### ✅ Staging runs this commit · `1233c76`/);
    assert.match(out, /3 min/);
    assert.doesNotMatch(out, /Railway config/);
    assert.match(out, /\*\*End-to-end tests\*\*: 14 passed/);
    assert.match(out, /<details><summary>Details<\/summary>\n\nSeller 2/);
});

test("a failed deploy names the step first, unfolded, and says what did not run", () => {
    const s = {
        ...base,
        steps: [
            { id: "api", name: "API", state: "success", detail: "93 s" },
            { id: "apps", name: "Apps", state: "waiting", detail: "" },
            { id: "e2e", name: "End-to-end tests", state: "failure", detail: "1 of 14 failed" },
        ],
        sections: { e2e: "the reason", _: "**Next:** do this" },
    };
    const out = render(s, "<!-- m -->", 0);
    assert.match(out, /### ❌ Deploy to staging failed: End-to-end tests/);
    assert.ok(out.indexOf("End-to-end tests**") < out.indexOf("**API**"));
    assert.match(out, /⏸ \*\*Apps\*\*: did not run/);
    assert.doesNotMatch(out, /<details>/);
    assert.match(out, /the reason/);
    assert.match(out, /\*\*Next:\*\* do this/);
});

test("the state rides along, so another job can update it", () => {
    const s = { ...base, steps: [] };
    const out = render(s, "<!-- m -->", 0);
    assert.deepEqual(JSON.parse(out.match(/<!-- state:(.*) -->/)[1]), s);
});

const log = (lines) => lines.join("\n");

test("e2e: all passing is a count and areas", () => {
    const out = e2eSummary(
        log([
            "--- PASS: TestHealth_RunsTheCommitUnderTest (0.78s)",
            "--- PASS: TestMonitoring_TimingAndEventsReachThePhone (1.20s)",
            "--- PASS: TestSignIn_AppRules (0.61s)",
            "--- PASS: TestMe_SellerSeesOnlyTheirStore (0.65s)",
            "--- PASS: TestMe_AdminSeesTheWholeTenantAndNoOther (0.74s)",
            "--- PASS: TestBackoffice_Boundaries (1.98s)",
            "--- PASS: TestSeller_AWholeDay (6.34s)",
        ]),
    );
    assert.equal(out.detail, "7 passed");
    assert.equal(out.body, "Monitoring and health 2 · Sign-in 1 · Seller 2 · Backoffice 2");
});

test("e2e: a failure shows its plain name and reason, and only its own", () => {
    const out = e2eSummary(
        log([
            "=== RUN   TestSeller_AWholeDay",
            "--- PASS: TestSeller_AWholeDay (1s)",
            "=== RUN   TestBackoffice_EveryTabAnswers",
            "    e2e_test.go:254: /feedbacks: 404 route_not_found",
            "--- FAIL: TestBackoffice_EveryTabAnswers (3.10s)",
            "FAIL",
        ]),
    );
    assert.equal(out.detail, "1 of 2 failed");
    assert.match(out.body, /\*\*Backoffice: every tab answers\*\*/);
    assert.match(out.body, /\/feedbacks: 404 route_not_found/);
    assert.doesNotMatch(out.body, /Seller/);
});

test("e2e: no tests at all says so, with the end of the log", () => {
    const out = e2eSummary("# build failed\nundefined: foo\n");
    assert.equal(out.detail, "did not run");
    assert.match(out.body, /undefined: foo/);
});

const passing = (outputs = {}) => ({ result: "success", outputs });
const needs = () => ({
    start: passing(),
    checks: passing({ bundle: "seller 139 KB · backoffice 147 KB" }),
    integration: passing(),
    docker: passing(),
    "dependency-review": passing(),
    migrations: { result: "skipped", outputs: {} },
    previews: { result: "skipped", outputs: {} },
    e2e: { result: "skipped", outputs: {} },
    benchmark: { result: "skipped", outputs: {} },
});

test("before the merge, passing: one line of checks, skipped ones left out", () => {
    const out = prComment({ needs: needs(), previews: { seller: "https://s" } });
    assert.equal(out.state, "success");
    assert.equal(out.title, "Ready to merge");
    assert.match(out.body, /^Checks ✅ · Tests ✅ · Docker ✅ · Security ✅\n/);
    assert.match(out.body, /Bundle: seller 139 KB/);
    assert.match(out.body, /\[seller\]\(https:\/\/s\)/);
    assert.doesNotMatch(out.body, /Next/);
});

test("before the merge, failing: the title names it, with the reason and the next step", () => {
    const n = needs();
    n.integration = { result: "failure", outputs: {} };
    const out = prComment({ needs: n, failures: "the log" });
    assert.equal(out.state, "failure");
    assert.equal(out.title, "Not ready: Tests");
    assert.match(out.body, /Tests ❌/);
    assert.match(out.body, /the log/);
    assert.match(out.body, /Nothing has reached staging/);
});

test("a release PR says so, and a failed benchmark never blocks it", () => {
    const n = needs();
    n.e2e = passing({ detail: "14 passed" });
    n.benchmark = { result: "failure", outputs: { body: "numbers" } };
    const out = prComment({ needs: n, toMain: true });
    assert.equal(out.title, "Ready to release");
    assert.match(out.body, /E2E: 14 passed/);
    assert.match(out.body, /<summary>Speed<\/summary>/);
});
