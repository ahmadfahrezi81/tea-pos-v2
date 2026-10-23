// The RFC's benchmark, the same way every time, as a signed-in user opening home:
// 20× CPU, Slow 4G, cache disabled, 3 reopens and 3 first visits, medians, and a row
// for the RFC's Benchmark log. Task: .claude/tasks/014c_bench-script.md
//
//   pnpm bench --sign-in <url>    once per app: sign in with Google in the window that opens
//   pnpm bench <url>              the benchmark
//   pnpm bench --sign-out <url>   end that session and delete the profile
//
// On staging, a test user instead of Google (TEST_LOGIN_KEY from Infisical staging /app):
//   infisical run --env=staging --path=/app -- pnpm bench --test-user admin@test-a.test <url>
//
// Options: --runs N (3), --reopen-only, --first-only, --chrome-start S (4.0).
// BENCH_REPORT=file also writes the results as Markdown (the release PR's comment);
// BENCH_DEVICE names the machine in the log row (default "pnpm bench").
import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import puppeteer, { PredefinedNetworkConditions } from "puppeteer-core";

// Its own Chrome profile: the session cookie lives here, as on a phone. Never in the repo.
const PROFILE = process.env.BENCH_PROFILE ?? join(homedir(), ".tea-pos-bench");
const CHROME =
    process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// The M11's open (5.5 s) minus our part (~1.5 s): Android starting Chrome. Added to the
// report, not waited in the run, so runs still show whether a PR helped.
const CHROME_START_DEFAULT = 4.0;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
};
const url = args.find((a) => /^https?:\/\//.test(a));
if (!url) {
    console.error("Usage: pnpm bench [--sign-in | --sign-out] <url>");
    process.exit(1);
}
const origin = new URL(url).origin;
const runs = Number(option("--runs", 3));
const chromeStart = Number(option("--chrome-start", CHROME_START_DEFAULT));

const mac = process.platform === "darwin";
const launch = (headless) =>
    puppeteer.launch({
        executablePath: CHROME,
        userDataDir: PROFILE,
        headless,
        defaultViewport: { width: 412, height: 915 },
        // On a Mac, the real keychain, not Puppeteer's stand-in: the sign-in Chrome saved the cookie with it.
        ignoreDefaultArgs: mac ? ["--use-mock-keychain", "--password-store=basic"] : [],
        // GitHub's Ubuntu runners block Chrome's sandbox.
        args: mac ? [] : ["--no-sandbox"],
    });

// A plain Chrome, not one a script drives: Google refuses to sign in to the latter.
if (flag("--sign-in")) {
    console.log("Sign in with Google in the window, wait for home, then quit that Chrome (Cmd+Q).");
    const chrome = spawn(
        CHROME,
        [`--user-data-dir=${PROFILE}`, "--no-first-run", `${origin}/login`],
        {
            stdio: "ignore",
        },
    );
    await new Promise((done) => chrome.on("exit", done));
    process.exit(0);
}

if (flag("--sign-out")) {
    const browser = await launch(true);
    const [page] = await browser.pages();
    await page.goto(origin);
    await page.evaluate(() => fetch("/api/auth/logout", { method: "POST" }));
    await browser.close();
    rmSync(PROFILE, { recursive: true, force: true });
    console.log(`Signed out of ${origin} and deleted ${PROFILE}.`);
    process.exit(0);
}

// The same numbers docs/benchmark.js prints, read inside the page after it settles.
function readMetrics() {
    return new Promise((done) => {
        const lcp = [];
        const tasks = [];
        const observe = (type, list) =>
            new PerformanceObserver((l) => list.push(...l.getEntries())).observe({
                type,
                buffered: true,
            });
        observe("largest-contentful-paint", lcp);
        observe("longtask", tasks);
        setTimeout(() => {
            const res = performance.getEntriesByType("resource");
            const me = res.find((r) => r.name.includes("/api/me"));
            const main = res.find((r) => /\/assets\/index-.*\.js$/.test(r.name));
            done({
                path: location.pathname,
                splash: performance.getEntriesByName("first-contentful-paint")[0]?.startTime,
                lcp: lcp.at(-1)?.startTime,
                ready: performance.getEntriesByName("tea-pos:ready")[0]?.startTime,
                meStart: me?.startTime,
                meEnd: me?.responseEnd,
                mainJs: main?.responseEnd,
                longTasks: tasks.reduce((s, t) => s + t.duration, 0),
            });
        }, 50);
    });
}

async function throttle(page) {
    await page.emulateCPUThrottling(20);
    await page.emulateNetworkConditions(PredefinedNetworkConditions["Slow 4G"]);
    await page.setCacheEnabled(false);
}

async function unthrottle(page) {
    await page.emulateCPUThrottling(1);
    await page.emulateNetworkConditions(null);
}

// Loads (or reloads) under throttling and waits for the app to say it is ready, then for the quiet after.
// What the page showed when a load never finished, for the log.
const describe = (page) =>
    page
        .evaluate(() => ({
            path: location.pathname,
            state: document.readyState,
            splash: !!document.getElementById("splash"),
            worker: !!navigator.serviceWorker?.controller,
        }))
        .catch((e) => ({ error: String(e) }));

// Loads (or reloads) under throttling and waits for the app to say it is ready, then for the quiet after.
// A load that never finishes (a shared runner sometimes stalls one) is tried once more, then fails.
async function measure(page, load, attempt = 1) {
    await throttle(page);
    await load();
    const outcome = await page
        .waitForFunction(
            () =>
                location.pathname === "/login" ||
                performance.getEntriesByName("tea-pos:ready").length > 0,
            { timeout: 60_000, polling: 500 },
        )
        .then(() => page.evaluate(() => (location.pathname === "/login" ? "signed out" : "ready")))
        .catch(() => "stalled");
    if (outcome === "stalled") {
        console.error(`load ${attempt} stalled after 60 s:`, JSON.stringify(await describe(page)));
        await unthrottle(page);
        if (attempt === 2) throw new Error("two loads in a row never became ready");
        return measure(page, load, 2);
    }
    if (outcome === "signed out") {
        console.error(`Not signed in on ${origin}. Run: pnpm bench --sign-in ${origin}`);
        process.exit(1);
    }
    // Let the work after ready (the avatar, the saved cache) land in the long tasks too.
    await new Promise((r) => setTimeout(r, 3000));
    const metrics = await page.evaluate(readMetrics);
    await unthrottle(page);
    return metrics;
}

const median = (values) => {
    const v = values.filter((x) => x != null).sort((a, b) => a - b);
    if (!v.length) return undefined;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};
const summarize = (list) =>
    Object.fromEntries(
        Object.keys(list[0])
            .filter((k) => k !== "path")
            .map((k) => [k, median(list.map((m) => m[k]))]),
    );

const browser = await launch(true);
const [page] = await browser.pages();
const cdp = await page.createCDPSession();
const results = {};

const testUser = option("--test-user");
if (testUser) {
    if (!process.env.TEST_LOGIN_KEY) {
        console.error(
            "--test-user needs TEST_LOGIN_KEY: run it under infisical run --env=staging --path=/app",
        );
        process.exit(1);
    }
    // The staging test sign-in sets the same session cookie Google would.
    await page.goto(`${origin}/login`);
    const status = await page.evaluate(
        (email, key) =>
            fetch("/api/auth/test", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Test-Key": key },
                body: JSON.stringify({ email }),
            }).then((r) => r.status),
        testUser,
        process.env.TEST_LOGIN_KEY,
    );
    if (status !== 204) {
        console.error(
            `Test sign-in as ${testUser} failed (${status}); staging only, test- tenants only.`,
        );
        process.exit(1);
    }
}

// Warm up once unthrottled, so the service worker and the saved cache exist for the reopens.
// The cache is written a moment after the app is ready, so wait for both.
await page.goto(url, { waitUntil: "networkidle0" });
await page
    .waitForFunction(() => performance.getEntriesByName("tea-pos:ready").length > 0, {
        timeout: 30_000,
    })
    .catch(() => {});
await new Promise((r) => setTimeout(r, 2000));

if (!flag("--first-only")) {
    const list = [];
    for (let i = 0; i < runs; i++) {
        list.push(await measure(page, () => page.reload()));
        process.stdout.write(`reopen ${i + 1}/${runs}\r`);
    }
    results.reopen = summarize(list);
}

if (!flag("--reopen-only")) {
    const list = [];
    for (let i = 0; i < runs; i++) {
        await page.goto("about:blank");
        // Everything a fresh install lacks, but the session cookie stays.
        await cdp.send("Storage.clearDataForOrigin", {
            origin,
            storageTypes: "service_workers,cache_storage,indexeddb,local_storage",
        });
        list.push(await measure(page, () => page.goto(url)));
        process.stdout.write(`first visit ${i + 1}/${runs}\r`);
    }
    results.first = summarize(list);
}
await browser.close();

const health = await fetch(`${origin}/api/health`)
    .then((r) => r.json())
    .catch(() => ({}));
const commit = health.commit?.slice(0, 7) ?? "?";
const s = (n) => (n == null ? "–" : `${(n / 1000).toFixed(2)} s`);
const msOf = (n) => (n == null ? "–" : `${Math.round(n)} ms`);

const rows = {
    splash: (m) => s(m.splash),
    LCP: (m) => s(m.lcp),
    "app ready": (m) => s(m.ready),
    "/me": (m) => `${s(m.meStart)} → ${s(m.meEnd)}`,
    "main JS loaded": (m) => s(m.mainJs),
    "long tasks": (m) => msOf(m.longTasks),
    // A slow phone also waits for Android to start Chrome: imagine it with this row.
    [`slow phone ≈ app ready + ${chromeStart.toFixed(1)} s (Galaxy M11)`]: (m) =>
        m.ready == null ? "–" : `${(chromeStart + m.ready / 1000).toFixed(2)} s`,
};
const table = {};
for (const [label, cell] of Object.entries(rows)) {
    table[label] = {};
    if (results.reopen) table[label][`reopen (median of ${runs})`] = cell(results.reopen);
    if (results.first) table[label][`first visit (median of ${runs})`] = cell(results.first);
}
console.log(`\n${origin} at ${commit}: 20× CPU, Slow 4G, cache disabled\n`);
console.table(table);

const when = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" }).slice(0, 16);
const app = new URL(origin).hostname.split(".")[0];
const device = process.env.BENCH_DEVICE ?? "pnpm bench";
const logRows = [
    ["Reopen", results.reopen],
    ["First visit", results.first],
]
    .filter(([, m]) => m)
    .map(
        ([visit, m]) =>
            `| ${when} WIB | \`${commit}\` (${app}) | ${device} | ${visit} | ${s(m.splash)} | ${s(m.ready)} | ${msOf(m.longTasks)} long tasks | median of ${runs}; /me ${s(m.meStart)} → ${s(m.meEnd)}; slow phone ≈ ${m.ready == null ? "–" : `${(chromeStart + m.ready / 1000).toFixed(2)} s`} |`,
    );
console.log("\nBenchmark log rows:");
for (const row of logRows) console.log(row);

if (process.env.BENCH_REPORT) {
    const columns = Object.keys(Object.values(table)[0]);
    const md = [
        `**${app}** at \`${commit}\`: 20× CPU, Slow 4G, cache disabled, median of ${runs}`,
        "",
        `| | ${columns.join(" | ")} |`,
        `| --- | ${columns.map(() => "---").join(" | ")} |`,
        ...Object.entries(table).map(
            ([label, cells]) => `| ${label} | ${Object.values(cells).join(" | ")} |`,
        ),
        "",
        "<details><summary>Benchmark log rows</summary>",
        "",
        "```",
        ...logRows,
        "```",
        "</details>",
    ];
    writeFileSync(process.env.BENCH_REPORT, md.join("\n") + "\n");
}
