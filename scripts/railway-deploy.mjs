// Deploys Railway services at one exact commit and waits until each is live (or failed).
// Railway does not deploy by itself (railway.ts: no branch, no Wait for CI); deploy.yml calls
// this, in order after the migrations. By hand, e.g. a rollback to the previous release:
//   APP_VERSION=2026.10.5 RAILWAY_TOKEN=<that environment's project token> node scripts/railway-deploy.mjs <commit> api realtime worker
// APP_VERSION is what /health will say: the release's version, or "staging".
// Writes one JSON line per service to $DEPLOY_REPORT when set (the PR comment's details).
import { appendFileSync } from "node:fs";

const [commit, ...services] = process.argv.slice(2);
const appVersion = process.env.APP_VERSION;
if (!commit || !services.length || !process.env.RAILWAY_TOKEN || !appVersion) {
    console.error(
        "Usage: APP_VERSION=... RAILWAY_TOKEN=... node scripts/railway-deploy.mjs <commit> <service>...",
    );
    process.exit(1);
}

async function q(query, variables) {
    const r = await fetch("https://backboard.railway.com/graphql/v2", {
        method: "POST",
        headers: {
            "Project-Access-Token": process.env.RAILWAY_TOKEN,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
    });
    const json = await r.json();
    if (json.errors) throw new Error(json.errors.map((e) => e.message).join("; "));
    return json.data;
}

// A project token belongs to one environment, so it names both.
const { projectId, environmentId } = (await q("{ projectToken { projectId environmentId } }"))
    .projectToken;
const ids = Object.fromEntries(
    (
        await q(`{ project(id: "${projectId}") { services { edges { node { id name } } } } }`)
    ).project.services.edges.map((e) => [e.node.name, e.node.id]),
);

const DONE = ["SUCCESS", "FAILED", "CRASHED", "REMOVED", "SKIPPED"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function deploy(name) {
    const serviceId = ids[name];
    if (!serviceId) throw new Error(`no service named ${name}`);
    const started = Date.now();
    // The Dockerfile builds it in; skipDeploys, because the deploy below is the one wanted.
    await q(`mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }`, {
        input: {
            projectId,
            environmentId,
            serviceId,
            name: "APP_VERSION",
            value: appVersion,
            skipDeploys: true,
        },
    });
    const { serviceInstanceDeployV2: id } = await q(
        `mutation { serviceInstanceDeployV2(serviceId: "${serviceId}", environmentId: "${environmentId}", commitSha: "${commit}") }`,
    );
    const url = `https://railway.com/project/${projectId}/service/${serviceId}?environmentId=${environmentId}&id=${id}`;
    console.log(`${name}: deploying ${commit.slice(0, 7)} (${url})`);
    // Builds take a few minutes; give up after 20.
    let status = "UNKNOWN";
    while (Date.now() - started < 20 * 60_000) {
        await sleep(10_000);
        status = (await q(`{ deployment(id: "${id}") { status } }`)).deployment.status;
        if (DONE.includes(status)) break;
    }
    const seconds = Math.round((Date.now() - started) / 1000);
    console.log(`${name}: ${status} after ${seconds} s`);
    if (process.env.DEPLOY_REPORT) {
        appendFileSync(
            process.env.DEPLOY_REPORT,
            JSON.stringify({ name, status, seconds, url }) + "\n",
        );
    }
    return status === "SUCCESS";
}

const results = await Promise.all(services.map(deploy));
process.exit(results.every(Boolean) ? 0 : 1);
