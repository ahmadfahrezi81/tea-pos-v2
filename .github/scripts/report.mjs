// One template for every CI comment on a PR: a status header, an optional row per step, then
// sections. Each comment is edited in place; its state rides along in a hidden line, so jobs on
// different machines can each update their own step. Used by .github/actions/report.
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

const ICON = { success: "✅", failure: "❌", running: "⏳", waiting: "⏸", skipped: "➖" };
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

function overall(s) {
    const states = s.steps.map((x) => x.state);
    if (s.state) return s.state;
    if (states.includes("failure")) return "failure";
    if (states.some((x) => x === "running" || x === "waiting")) return "running";
    return "success";
}

function minutes(ms) {
    const m = Math.round(ms / 60000);
    return m < 1 ? "under a minute" : `${m} min`;
}

function render(s) {
    const state = overall(s);
    const done = state === "success" || state === "failure";
    const words = { success: s.doneText ?? "Done", failure: "Failed", running: "Running" }[state];
    const time = s.steps.length
        ? ` · ${done ? "took" : "running for"} ${minutes(Date.now() - s.startedAt)}`
        : "";
    const lines = [
        marker,
        `<!-- state:${JSON.stringify(s)} -->`,
        `### ${ICON[state] ?? "⏳"} ${s.title}${s.commit ? ` · \`${s.commit.slice(0, 7)}\`` : ""}`,
        `${words}${time} · [run](${s.run})`,
        "",
    ];
    if (s.steps.length) {
        lines.push("| | Step | |", "| --- | --- | --- |");
        for (const x of s.steps)
            lines.push(`| ${ICON[x.state] ?? ""} | ${x.name} | ${x.detail ?? ""} |`);
        lines.push("");
    }
    for (const x of s.steps) if (s.sections?.[x.id]) lines.push(s.sections[x.id], "");
    if (s.sections?._) lines.push(s.sections._, "");
    return lines.join("\n");
}

const found = await existing();
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
if (env.REPORT_OVERALL) s.state = env.REPORT_OVERALL;
const step = s.steps.find((x) => x.id === env.REPORT_STEP);
if (step) {
    if (env.REPORT_STATE) step.state = env.REPORT_STATE;
    if (env.REPORT_DETAIL) step.detail = env.REPORT_DETAIL;
}
if (env.REPORT_BODY) s.sections[env.REPORT_STEP || "_"] = env.REPORT_BODY;

const body = render(s);
if (found)
    await api(`/issues/comments/${found.id}`, { method: "PATCH", body: JSON.stringify({ body }) });
else await api(`/issues/${pr}/comments`, { method: "POST", body: JSON.stringify({ body }) });
console.log(body);
