import { defineRailway, github, project, service } from "railway/iac";

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
    // Only these are set from here; secrets are left to Infisical, which syncs them into Railway.
    const env = (gomemlimit: string) => ({
        ENV: prod ? "prod" : "staging",
        LOG_LEVEL: "info",
        GOMEMLIMIT: gomemlimit,
    });

    const api = service("api", {
        source: repo,
        build,
        deploy,
        start: "/app/api",
        healthcheck: "/health",
        replicas,
        env: env("200MiB"),
    });
    const realtime = service("realtime", {
        source: repo,
        build,
        deploy,
        start: "/app/realtime",
        healthcheck: "/health",
        replicas,
        env: env("100MiB"),
    });
    const worker = service("worker", {
        source: repo,
        build,
        deploy,
        start: "/app/worker",
        replicas,
        env: env("100MiB"),
    });

    return project("tea-pos-v2", {
        resources: [api, realtime, worker],
    });
});
