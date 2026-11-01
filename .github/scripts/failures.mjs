// Why a run failed, as Markdown for a PR comment: each failed job, its step and last log lines.
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const {
    GH_TOKEN,
    GITHUB_REPOSITORY,
    GITHUB_RUN_ID,
    GITHUB_OUTPUT,
    FAILURES_JOB = "",
} = process.env;
const LINES = 30;

const api = (path) =>
    fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}${path}`, {
        headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" },
    });

/** The lines before the first error: past it, the log is only the job cleaning up. */
function why(log) {
    const lines = log
        .split("\n")
        // eslint-disable-next-line no-control-regex
        .map((l) => l.replace(/^\S+Z /, "").replace(/\u001b\[[0-9;]*m/g, ""))
        .filter((l) => !l.startsWith("##[group]") && !l.startsWith("##[endgroup]"));
    const end = lines.findIndex((l) => l.startsWith("##[error]"));
    const upto = end < 0 ? lines : lines.slice(0, end + 1);
    return upto
        .slice(-LINES)
        .map((l) => l.slice(0, 300))
        .join("\n");
}

/** Each failed job of this run: its name, the step that failed, and its last log lines. */
export async function failedJobs() {
    const res = await api(`/actions/runs/${GITHUB_RUN_ID}/jobs?per_page=100`);
    if (!res.ok) throw new Error(`could not read the run's jobs (${res.status})`);
    const { jobs } = await res.json();
    const failed = jobs.filter((j) => j.conclusion === "failure" && j.name.includes(FAILURES_JOB));
    return Promise.all(
        failed.map(async (job) => {
            const log = await api(`/actions/jobs/${job.id}/logs`);
            return {
                name: job.name,
                step: job.steps?.find((s) => s.conclusion === "failure")?.name ?? "before any step",
                log: log.ok ? why(await log.text()) : "(the log could not be read)",
            };
        }),
    );
}

export const asMarkdown = (jobs) =>
    jobs.map((j) => `**\`${j.name}\`** failed at: ${j.step}\n\n~~~~\n${j.log}\n~~~~`).join("\n\n");

async function report() {
    return asMarkdown(await failedJobs());
}

export const safeReport = () => report().catch((e) => `Could not read the run: ${e.message}`);

// Never fails the job: a comment without the reason still beats no comment.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const body = await safeReport();
    console.log(body);
    if (GITHUB_OUTPUT) {
        const mark = `EOF_${Date.now()}`;
        appendFileSync(GITHUB_OUTPUT, `body<<${mark}\n${body}\n${mark}\n`);
    }
}
