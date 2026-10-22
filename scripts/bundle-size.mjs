// Gzipped JavaScript each app's first screen loads, against its budget: the entry
// and everything index.html preloads (the first screen's routes and languages, set
// in packages/config/vite.ts). Run after `pnpm build`. Writes a Markdown table to
// $BUNDLE_REPORT when set (the PR comment) and fails over budget.
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

// KB gzip. Raised on purpose by the step that needs more, up to the POS's 170.
const BUDGET_KB = 130;
const APPS = ["seller", "backoffice"];

const rows = [];
let failed = false;

for (const app of APPS) {
    const dist = `apps/${app}/dist`;
    const html = readFileSync(`${dist}/index.html`, "utf8");
    const scripts = [
        ...html.matchAll(
            /<(?:script[^>]*src|link[^>]*rel="modulepreload"[^>]*href)="\/([^"]+\.js)"/g,
        ),
    ];
    const files = new Set(scripts.map((match) => match[1]));
    // Only one language loads; count the largest preloaded, not all of them.
    const languages = [...files].filter((file) => /^assets\/(en|id)-/.test(file));
    const largest = Math.max(
        0,
        ...languages.map((file) => gzipSync(readFileSync(`${dist}/${file}`)).length),
    );
    let bytes = largest;
    for (const file of files) {
        if (!languages.includes(file)) bytes += gzipSync(readFileSync(`${dist}/${file}`)).length;
    }

    const kb = bytes / 1024;
    const over = kb > BUDGET_KB;
    failed ||= over;
    rows.push(`| ${app} | ${kb.toFixed(1)} KB | ${BUDGET_KB} KB | ${over ? "❌ over" : "✅"} |`);
}

const report = [
    "### Bundle size",
    "JavaScript the first screen loads, gzip.",
    "",
    "| App | Size | Budget | |",
    "| --- | --- | --- | --- |",
    ...rows,
].join("\n");
console.log(report);
if (process.env.BUNDLE_REPORT) writeFileSync(process.env.BUNDLE_REPORT, report);
if (failed) process.exit(1);
