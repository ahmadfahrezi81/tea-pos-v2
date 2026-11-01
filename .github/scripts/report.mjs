// Writes a CI comment on a PR (what it says: render.mjs). Each comment is edited in place; its state
// rides along in a hidden line, so jobs on different machines can each update their own step. Used
// by .github/actions/report.
import { render } from "./render.mjs";

const env = process.env;
const repo = env.GITHUB_REPOSITORY;
const api = (path, init = {}) =>
    fetch(`https://api.github.com/repos/${repo}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${env.GH_TOKEN}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
        },
    }).then(async (r) => {
        if (!r.ok)
            throw new Error(`${init.method ?? "GET"} ${path}: ${r.status} ${await r.text()}`);
        return r.status === 204 ? null : r.json();
    });

const marker = `<!-- pr-comment:${env.REPORT_SECTION} -->`;
const pr = env.REPORT_PR;
if (!pr) {
    console.log("No PR to comment on; nothing posted.");
    process.exit(0);
}

async function existing() {
    for (let page = 1; ; page++) {
        const list = await api(`/issues/${pr}/comments?per_page=100&page=${page}`);
        const found = list.find((c) => c.body.startsWith(marker));
        if (found || list.length < 100) return found;
    }
}

const found = await existing();
// A check that only speaks once it has something to say: a pass updates a failure, or says nothing.
if (!found && env.REPORT_UPDATE_ONLY === "true") process.exit(0);
const old = found?.body.match(/<!-- state:(.*) -->/)?.[1];
let s = old && env.REPORT_RESET !== "true" ? JSON.parse(old) : null;
if (!s) {
    // REPORT_STEPS: "id=Name,id=Name"; steps start as waiting.
    s = {
        title: env.REPORT_TITLE,
        commit: env.REPORT_COMMIT,
        startedAt: Date.now(),
        steps: (env.REPORT_STEPS ?? "")
            .split(",")
            .filter(Boolean)
            .map((x) => {
                const [id, name] = x.split("=");
                return { id, name, state: "waiting", detail: "" };
            }),
        sections: {},
    };
}
s.run = env.REPORT_RUN;
if (env.REPORT_TITLE) s.title = env.REPORT_TITLE;
// A new push updates the comment it already has, so it names the new commit.
if (env.REPORT_COMMIT) s.commit = env.REPORT_COMMIT;
if (env.REPORT_DONE_TEXT) s.doneText = env.REPORT_DONE_TEXT;
if (env.REPORT_IDLE_TEXT) s.idleText = env.REPORT_IDLE_TEXT;
if (env.REPORT_OVERALL) s.state = env.REPORT_OVERALL;
const step = s.steps.find((x) => x.id === env.REPORT_STEP);
if (step) {
    if (env.REPORT_STATE) step.state = env.REPORT_STATE;
    if (env.REPORT_DETAIL) step.detail = env.REPORT_DETAIL;
}
if (env.REPORT_BODY) s.sections[env.REPORT_STEP || "_"] = env.REPORT_BODY;

const body = render(s, marker);
if (found)
    await api(`/issues/comments/${found.id}`, { method: "PATCH", body: JSON.stringify({ body }) });
else await api(`/issues/${pr}/comments`, { method: "POST", body: JSON.stringify({ body }) });
console.log(body);
