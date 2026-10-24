import { defineRailway, github, preserve, project, service } from "railway/iac";

// Production runs releases from main, staging runs merges into staging (deploy.yml). Change settings here, never in the dashboard.
export default defineRailway((ctx) => {
    const prod = ctx.isEnvironment("production");
    // Railway never deploys by itself: deploy.yml deploys each commit in order (migrations, the
    // API, then the apps) through scripts/railway-deploy.mjs. Railway can only express "no auto
    // deploy" as a trigger on a branch nobody pushes, so that is what this names. No branch at all
    // would mean the default branch, main.
    const repo = github("ahmadfahrezi81/tea-pos-v2", {
        branch: "railway-manual",
        checkSuites: false,
    });
    const replicas = { "asia-southeast1-eqsg3a": 1 };
    const build = { builder: "DOCKERFILE" as const };
    // A sleeping service drops every WebSocket.
    const deploy = { sleepApplication: false };
    // Railway manages every variable from this file: an undeclared one is removed on apply.
    // Secrets Infisical syncs in must be declared too, as preserve(), so their values are kept.
    const env = (gomemlimit: string, dbMaxConns: string) => ({
        ENV: prod ? "prod" : "staging",
        LOG_LEVEL: "info",
        GOMEMLIMIT: gomemlimit,
        // Fixed pools: Supabase allows 60 connections and its own services hold about 25.
        DB_MAX_CONNS: dbMaxConns,
        // The release's version (or "staging"), set by scripts/railway-deploy.mjs before each deploy.
        APP_VERSION: preserve(),
    });

    const api = service("api", {
        source: repo,
        build,
        deploy,
        start: "/app/api",
        healthcheck: "/health",
        replicas,
        // Infisical syncs these into api only; the others reference what they need.
        env: {
            ...env("200MiB", "8"),
            DATABASE_URL: preserve(),
            EDGE_SECRET: preserve(),
            SUPABASE_URL: preserve(),
            SUPABASE_PUBLISHABLE_KEY: preserve(),
            // Signs photo uploads and private reads (Storage); never leaves Go.
            SUPABASE_SECRET_KEY: preserve(),
            // PostHog: errors, the apps' events, flags. Each rules download is billed as 10 flag
            // checks (1M free a month): every 60 s is 432k, staging every 5 min 86k.
            POSTHOG_KEY: preserve(),
            POSTHOG_FLAGS_KEY: preserve(),
            POSTHOG_FLAGS_POLL_SECONDS: prod ? "60" : "300",
            // The worker's weather (it references this; Infisical syncs into api only).
            TOMORROW_IO_API_KEY: preserve(),
            // When a release breaks older apps, its PR adds e.g. MIN_APP_VERSION: "seller@2026.11.2"
            // (426, and the app updates itself).

            // Staging only: the test sign-in for end-to-end tests, compiled in by the build tag.
            ...(prod ? {} : { GO_BUILD_TAGS: "testlogin", TEST_LOGIN_KEY: preserve() }),
        },
    });
    const realtime = service("realtime", {
        source: repo,
        build,
        deploy,
        start: "/app/realtime",
        healthcheck: "/health",
        replicas,
        env: {
            ...env("100MiB", "2"),
            DATABASE_URL: api.env.DATABASE_URL,
            EDGE_SECRET: api.env.EDGE_SECRET,
            POSTHOG_KEY: api.env.POSTHOG_KEY,
        },
    });
    const worker = service("worker", {
        source: repo,
        build,
        deploy,
        start: "/app/worker",
        replicas,
        env: {
            ...env("100MiB", "4"),
            DATABASE_URL: api.env.DATABASE_URL,
            TOMORROW_IO_API_KEY: api.env.TOMORROW_IO_API_KEY,
            POSTHOG_KEY: api.env.POSTHOG_KEY,
            // v2's cron, its schedules per environment in internal/jobs (Schedules).
            JOBS_SCHEDULE: "on",
        },
    });

    // Nightly dump of production to R2 at 20:00 UTC (03:00 WIB); runs, uploads, exits. Staging's data is fake.
    const backup = service("backup", {
        source: repo,
        rootDirectory: "ops/backup",
        build: { builder: "DOCKERFILE" as const },
        deploy: { cronSchedule: "0 20 * * *", restartPolicyType: "NEVER" as const },
        replicas,
        env: {
            R2_BUCKET: "tea-pos-backups",
            DATABASE_URL: preserve(),
            R2_ACCOUNT_ID: preserve(),
            R2_ACCESS_KEY_ID: preserve(),
            R2_SECRET_ACCESS_KEY: preserve(),
            HC_PING_URL: preserve(),
            APP_VERSION: preserve(),
        },
    });

    return project("tea-pos-v2", {
        resources: [api, realtime, worker, ...(prod ? [backup] : [])],
    });
});
