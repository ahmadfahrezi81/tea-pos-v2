import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

const script = new URL("./deploy-plan.sh", import.meta.url).pathname;

function plan(changed, env = {}) {
    const out = execFileSync("bash", [script], {
        encoding: "utf8",
        env: {
            ...process.env,
            GITHUB_REF_NAME: "staging",
            GITHUB_SHA: "abc",
            GITHUB_REPOSITORY: "o/r",
            PLAN_CHANGED: changed,
            ...env,
        },
    });
    return Object.fromEntries(
        out
            .trim()
            .split("\n")
            .map((l) => l.split(/=(.*)/s).slice(0, 2)),
    );
}

test("workflow files alone deploy nothing", () => {
    const p = plan(".github/workflows/pr.yml\ndocs/runbook.md");
    assert.equal(p.services, "");
    assert.equal(p.apps, "false");
    assert.equal(p.migrations, "false");
    assert.equal(p.config, "false");
});

test("an API file deploys every Go service; an API test too", () => {
    assert.equal(plan("api/internal/x.go").services, "api realtime worker");
    assert.equal(plan("api/tests/e2e/e2e_test.go").services, "api realtime worker");
    assert.equal(plan("Dockerfile").services, "api realtime worker");
});

test("each kind of change switches on only its own step", () => {
    assert.equal(plan("packages/ui/x.tsx").apps, "true");
    assert.equal(plan("api/openapi.yaml").apps, "true");
    assert.equal(plan("supabase/migrations/1_a.sql").migrations, "true");
    assert.equal(plan(".railway/railway.ts").config, "true");
});

test("the backup deploys only on production", () => {
    assert.equal(plan("ops/backup/x.sh").services, "");
    const p = plan("ops/backup/x.sh", { GITHUB_REF_NAME: "main" });
    assert.equal(p.env, "production");
    assert.equal(p.services, "backup");
});

test("everything does all of it, whatever changed", () => {
    const p = plan("", { PLAN_EVERYTHING: "true" });
    assert.equal(p.services, "api realtime worker");
    assert.equal(p.apps, "true");
    assert.equal(p.migrations, "true");
    assert.equal(p.config, "true");
});
