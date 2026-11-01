// The comment before a merge: this step's title, state and body outputs, from every job's result.
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";

import { safeReport } from "./failures.mjs";
import { prComment } from "./render.mjs";

const needs = JSON.parse(process.env.NEEDS);
const previews = {};
if (existsSync("previews"))
    for (const f of readdirSync("previews")) {
        const app = f.replace(/^preview-|\.txt$/g, "");
        previews[app] = readFileSync(`previews/${f}`, "utf8").trim();
    }
const failed = Object.values(needs).some((n) => n.result === "failure");
const { state, title, body } = prComment({
    needs,
    previews,
    failures: failed ? await safeReport() : "",
    toMain: process.env.BASE === "main",
});
console.log(title, "\n", body);
const mark = `EOF_${Date.now()}`;
appendFileSync(
    process.env.GITHUB_OUTPUT,
    `state=${state}\ntitle=${title}\nbody<<${mark}\n${body}\n${mark}\n`,
);
