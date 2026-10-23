import { defineRailway, github, preserve, project, service } from "railway/iac";

// Production runs main, staging runs the staging branch. Change settings here, never in the dashboard.
export default defineRailway((ctx) => {
    const prod = ctx.isEnvironment("production");
    const repo = github("ahmadfahrezi81/tea-pos-v2", {
        branch: prod ? "main" : "staging",
        checkSuites: true,
    });
    const replicas = { "asia-southeast1-eqsg3a": 1 };
    const build = { builder: "DOCKERFILE" as const, watchPatterns: ["/api/**", "/Dockerfile"] };
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
        },
    });
    const worker = service("worker", {
        source: repo,
        build,
        deploy,
        start: "/app/worker",
        replicas,
        env: { ...env("100MiB", "4"), DATABASE_URL: api.env.DATABASE_URL },
    });

    // Nightly dump of production to R2 at 20:00 UTC (03:00 WIB); runs, uploads, exits. Staging's data is fake.
    const backup = service("backup", {
        source: repo,
        rootDirectory: "ops/backup",
        build: { builder: "DOCKERFILE" as const, watchPatterns: ["/ops/backup/**"] },
        deploy: { cronSchedule: "0 20 * * *", restartPolicyType: "NEVER" as const },
        replicas,
        env: {
            R2_BUCKET: "tea-pos-backups",
            DATABASE_URL: preserve(),
            R2_ACCOUNT_ID: preserve(),
            R2_ACCESS_KEY_ID: preserve(),
            R2_SECRET_ACCESS_KEY: preserve(),
            HC_PING_URL: preserve(),
        },
    });

    return project("tea-pos-v2", {
        resources: [api, realtime, worker, ...(prod ? [backup] : [])],
    });
});
