import assert from "node:assert/strict";
import { test } from "node:test";

import { e2eSummary, prComment, render } from "./render.mjs";

const base = {
    title: "Deploy to staging",
    doneText: "Deployed to staging",
    idleText: "Staging checked, nothing to deploy",
    commit: "1233c765",
    run: "u",
    startedAt: 0,
    sections: {},
};

test("a passing deploy leads with the answer, hides skipped steps, facts in sub-bullets", () => {
    const s = {
        ...base,
        steps: [
            { id: "config", name: "Railway config", state: "skipped", detail: "not changed" },
            {
                id: "api",
                name: "API",
                state: "success",
                detail: "[api](u) 93 s · [worker](u) 73 s",
            },
            { id: "e2e", name: "E2E", state: "success", detail: "14 passed" },
        ],
        sections: { e2e: "Sign-in 4, Seller 2" },
    };
    const out = render(s, "<!-- m -->", 180000).replace(/<!-- state:.*\n/, "");
    assert.match(out, /### ✅ Deployed to staging\n<sub>`1233c76` · 3 min · \[run\]\(u\)<\/sub>/);
    assert.doesNotMatch(out, /Railway config/);
    assert.match(out, /- ✅ API\n  - \[api\]\(u\) 93 s\n  - \[worker\]\(u\) 73 s/);
    assert.match(out, /- ✅ E2E: 14 passed\n  - Sign-in 4, Seller 2/);
});

test("a failed deploy names the step first, says what did not run, and boxes the next step", () => {
    const s = {
        ...base,
        steps: [
            { id: "api", name: "API", state: "success", detail: "93 s" },
            { id: "apps", name: "Apps", state: "waiting", detail: "" },
            { id: "e2e", name: "E2E", state: "failure", detail: "1 of 14 failed" },
        ],
        sections: { e2e: "Backoffice: every tab answers: a reason" },
    };
    const out = render(s, "<!-- m -->", 0);
    assert.match(out, /### ❌ Deployed to staging, but E2E failed/);
    assert.ok(out.indexOf("❌ E2E") < out.indexOf("✅ API"));
    assert.match(out, /- ❌ E2E: 1 of 14 failed\n  - Backoffice: every tab answers: a reason/);
    assert.match(out, /⏸ Apps: did not run/);
    assert.match(
        out,
        /> \[!CAUTION\]\n> \*\*Next:\*\* This commit is live on staging and failed its tests\. Do not release it\./,
    );
});

test("nothing deployed says so", () => {
    const steps = [
        { id: "api", name: "API", state: "skipped" },
        { id: "e2e", name: "E2E", state: "success", detail: "14 passed" },
    ];
    assert.match(render({ ...base, steps }, "m", 0), /### ✅ Staging checked, nothing to deploy/);
});

test("a failed deploy says what is live", () => {
    const steps = [
        { id: "api", name: "API", state: "failure", detail: "did not start" },
        { id: "apps", name: "Apps", state: "waiting" },
    ];
    const out = render({ ...base, steps }, "m", 0);
    assert.match(out, /### ❌ Deploy to staging failed: API/);
    assert.match(out, /The API on staging is still the previous version/);
});

test("waiting for an approval shows, with its link", () => {
    const steps = [
        {
            id: "migrate",
            name: "Migrations",
            state: "waiting",
            detail: "**waiting for your Approve:** [review](u)",
        },
        { id: "api", name: "API", state: "waiting" },
    ];
    const out = render({ ...base, title: "Deploy to production", steps }, "m", 0);
    assert.match(out, /### ⏳ Deploy to production: waiting/);
    assert.match(out, /Migrations: \*\*waiting for your Approve/);
    assert.doesNotMatch(out, /did not run/);
});

test("a table or a log stays a block, folded when passing and open when failing", () => {
    const steps = [{ id: "check", name: "Production check", state: "success", detail: "ok" }];
    const sections = { check: "| a | b |\n| - | - |" };
    assert.match(render({ ...base, steps, sections }, "m", 0), /<details>/);
    const failing = [{ ...steps[0], state: "failure" }];
    const out = render({ ...base, steps: failing, sections }, "m", 0);
    assert.doesNotMatch(out, /<details>/);
    assert.match(out, /\| a \| b \|/);
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
    assert.equal(out.body, "Monitoring and health 2, Sign-in 1, Seller 2\nBackoffice 2");
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
    assert.equal(out.body, "Backoffice: every tab answers: /feedbacks: 404 route_not_found");
});

test("without -v the reason follows the result, and log lines after it are not reasons", () => {
    const out = e2eSummary(
        log([
            "--- FAIL: TestTemporaryFailure (0.00s)",
            "    seller_test.go:390: fails on purpose",
            "2026/11/01 INFO request method=GET",
            "    other_test.go:1: belongs to nobody",
            "FAIL",
        ]),
    );
    assert.equal(out.detail, "1 of 1 failed");
    assert.equal(out.body, "Temporary Failure: fails on purpose");
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

test("before the merge, passing: a bullet per check, skipped ones left out", () => {
    const out = prComment({ needs: needs(), previews: { seller: "https://s" } });
    assert.equal(out.state, "success");
    assert.equal(out.title, "Ready to merge");
    assert.match(
        out.body,
        /^- ✅ Format, lint, types, unit tests, build\n- ✅ Integration and E2E tests\n- ✅ Docker images\n- ✅ No risky packages\n/,
    );
    assert.match(out.body, /- 📦 First screen size\n  - seller 139 KB\n  - backoffice 147 KB/);
    assert.doesNotMatch(out.body, /Next/);
    const n = needs();
    n.previews = passing();
    const shown = prComment({ needs: n, previews: { seller: "https://s" } });
    assert.match(shown.body, /- ✅ Previews\n  - \[seller\]\(https:\/\/s\)/);
});

test("before the merge, failing: what failed first, its reason under it, then the next step", () => {
    const n = needs();
    n.integration = { result: "failure", outputs: {} };
    const out = prComment({ needs: n, reasons: { integration: ["a reason"] }, log: "the log" });
    assert.equal(out.state, "failure");
    assert.equal(out.title, "Not ready: Integration and E2E tests failed");
    assert.match(out.body, /^- ❌ Integration and E2E tests\n  - a reason\n- ✅ Format/);
    assert.match(out.body, /> \[!CAUTION\]\n> \*\*Next:\*\* fix it on this PR/);
    assert.match(out.body, /<summary>Full log<\/summary>\n\nthe log/);
});

test("a release PR says so, and a failed benchmark never blocks it", () => {
    const n = needs();
    n.e2e = passing({ detail: "14 passed" });
    n.benchmark = { result: "failure", outputs: { body: "numbers" } };
    const out = prComment({ needs: n, toMain: true });
    assert.equal(out.title, "Ready to release");
    assert.match(out.body, /- ✅ E2E\n  - 14 passed/);
    assert.match(out.body, /<summary>Speed<\/summary>/);
});
