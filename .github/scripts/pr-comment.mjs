// The comment before a merge: this step's title, state and body outputs, from every job's result.
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";

import { asMarkdown, failedJobs } from "./failures.mjs";
import { e2eSummary, prComment } from "./render.mjs";

const needs = JSON.parse(process.env.NEEDS);
const previews = {};
if (existsSync("previews"))
    for (const f of readdirSync("previews")) {
        const app = f.replace(/^preview-|\.txt$/g, "");
        previews[app] = readFileSync(`previews/${f}`, "utf8").trim();
    }
// A test names itself; anything else names its step. Never fails: the comment still beats no comment.
const reasons = {};
let log = "";
if (Object.values(needs).some((n) => n.result === "failure")) {
    try {
        const jobs = await failedJobs();
        log = asMarkdown(jobs);
        for (const job of jobs) {
            const id = job.name.split(" ")[0];
            const tests = e2eSummary(job.full);
            const failing = tests.detail.includes("failed");
            reasons[id] = failing
                ? tests.body.split("\n")
                : [job.step.replace(/^Run /, "Failed at: ")];
        }
    } catch (e) {
        log = `Could not read the run: ${e.message}`;
    }
}
const { state, title, body } = prComment({
    needs,
    previews,
    reasons,
    log,
    toMain: process.env.BASE === "main",
});
console.log(title, "\n", body);
const mark = `EOF_${Date.now()}`;
appendFileSync(
    process.env.GITHUB_OUTPUT,
    `state=${state}\ntitle=${title}\nbody<<${mark}\n${body}\n${mark}\n`,
);
