// The RFC's benchmark, the same way every time, as a signed-in user opening home:
// 20× CPU, Slow 4G, cache disabled, 5 reopens and 5 first visits, medians, and a row
// for the RFC's Benchmark log. Task: .claude/tasks/014c_bench-script.md
//
//   pnpm bench --sign-in <url>    once per app: sign in with Google in the window that opens
//   pnpm bench <url>              the benchmark
//   pnpm bench --sign-out <url>   end that session and delete the profile
//
// Options: --runs N (5), --reopen-only, --first-only, --chrome-start S (4.0).
import { rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import puppeteer, { PredefinedNetworkConditions } from "puppeteer-core";

// Its own Chrome profile: the session cookie lives here, as on a phone. Never in the repo.
const PROFILE = join(homedir(), ".tea-pos-bench");
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
const runs = Number(option("--runs", 5));
const chromeStart = Number(option("--chrome-start", CHROME_START_DEFAULT));

const launch = (headless) =>
    puppeteer.launch({
        executablePath: CHROME,
        userDataDir: PROFILE,
        headless,
        defaultViewport: { width: 412, height: 915 },
    });

if (flag("--sign-in")) {
    const browser = await launch(false);
    const [page] = await browser.pages();
    await page.goto(`${origin}/login`);
    console.log("Sign in with Google in the window, then close it.");
    await new Promise((done) => browser.on("disconnected", done));
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
async function measure(page, load) {
    await throttle(page);
    await load();
    const signedOut = await page
        .waitForFunction(
            () =>
                location.pathname === "/login" ||
                performance.getEntriesByName("tea-pos:ready").length > 0,
            { timeout: 120_000, polling: 500 },
        )
        .then(() => page.evaluate(() => location.pathname === "/login"));
    if (signedOut) {
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

// Warm up once unthrottled, so the service worker and the saved cache exist for the reopens.
await page.goto(url, { waitUntil: "networkidle0" });

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
    [`on a Galaxy M11 ≈ ${chromeStart.toFixed(1)} s Chrome start +`]: (m) =>
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
console.log("\nBenchmark log rows:");
for (const [visit, m] of [
    ["Reopen", results.reopen],
    ["First visit", results.first],
]) {
    if (!m) continue;
    console.log(
        `| ${when} WIB | \`${commit}\` (${app}) | pnpm bench | ${visit} | ${s(m.splash)} | ${s(m.ready)} | ${msOf(m.longTasks)} long tasks | median of ${runs}; /me ${s(m.meStart)} → ${s(m.meEnd)} |`,
    );
}
