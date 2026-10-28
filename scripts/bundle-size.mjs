// Gzipped JavaScript each app's first screen loads, against its budget: the entry,
// everything index.html preloads (the first screen's routes, set in
// packages/config/vite.ts), and the largest language it can pick. Run after `pnpm build`. Writes a Markdown table to
// $BUNDLE_REPORT when set (the PR comment) and fails over budget.
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

// KB gzip. 500 for both while v1 runs, so no step stops to trim; brought back down after the
// migration (backoffice refinement Step 51b, and the seller's).
const BUDGET_KB = { seller: 500, backoffice: 500 };
const APPS = ["seller", "backoffice"];

const rows = [];
let failed = false;

for (const app of APPS) {
    const dist = `apps/${app}/dist`;
    const html = readFileSync(`${dist}/index.html`, "utf8");
    const size = (file) => gzipSync(readFileSync(`${dist}/${file}`)).length;
    const scripts = [
        ...html.matchAll(
            /<(?:script[^>]*src|link[^>]*rel="modulepreload"[^>]*href)="\/([^"]+\.js)"/g,
        ),
    ];
    let bytes = [...new Set(scripts.map((match) => match[1]))].reduce(
        (sum, file) => sum + size(file),
        0,
    );
    // index.html preloads one language, picked on the phone: count the largest it can pick.
    const languages = [...html.matchAll(/"\/(assets\/(?:en|id)-[^"]+\.js)"/g)].map(
        (match) => match[1],
    );
    bytes += Math.max(0, ...languages.map(size));

    const kb = bytes / 1024;
    const over = kb > BUDGET_KB[app];
    failed ||= over;
    rows.push(
        `| ${app} | ${kb.toFixed(1)} KB | ${BUDGET_KB[app]} KB | ${over ? "❌ over" : "✅"} |`,
    );
}

// The heading comes from the PR comment's template (.github/actions/report).
const report = [
    "JavaScript the first screen loads, gzip.",
    "",
    "| App | Size | Budget | |",
    "| --- | --- | --- | --- |",
    ...rows,
].join("\n");
console.log(report);
if (process.env.BUNDLE_REPORT) writeFileSync(process.env.BUNDLE_REPORT, report);
if (failed) process.exit(1);
