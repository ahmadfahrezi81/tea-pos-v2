// What the PR comments say, with no I/O so it can be tested. A comment answers, in order: is it OK,
// what broke, what next. Passing is short and failing is long.
const ICON = { success: "✅", failure: "❌", running: "⏳", waiting: "⏸", skipped: "➖" };

export function overall(s) {
    const states = s.steps.map((x) => x.state);
    if (s.state) return s.state;
    if (states.includes("failure")) return "failure";
    if (states.some((x) => x === "running" || x === "waiting")) return "running";
    return "success";
}

const minutes = (ms) => {
    const m = Math.round(ms / 60000);
    return m < 1 ? "under a minute" : `${m} min`;
};

const DEPLOYING = ["config", "migrate", "api", "apps"];
const VERIFYING = ["e2e", "check"];

function headline(s, state) {
    const failed = s.steps.filter((x) => x.state === "failure");
    if (state === "success") {
        const changed = s.steps.some((x) => DEPLOYING.includes(x.id) && x.state === "success");
        return s.steps.length && !changed && s.idleText ? s.idleText : (s.doneText ?? s.title);
    }
    if (!s.steps.length) return s.title;
    if (state === "failure") {
        const names = failed.map((x) => x.name).join(", ");
        // It deployed: what failed is the check on it, and that is a different problem.
        return failed.every((x) => VERIFYING.includes(x.id))
            ? `${s.doneText}, but ${names} failed`
            : `${s.title} failed: ${names}`;
    }
    const waiting = s.steps.some((x) => x.state === "waiting" && x.detail);
    return `${s.title}: ${waiting && !s.steps.some((x) => x.state === "running") ? "waiting" : "running"}`;
}

/** What a failed deploy leaves live, and what to do about it. */
function nextStep(s) {
    const failed = s.steps.find((x) => x.state === "failure")?.id;
    const where = s.title.split(" ").pop();
    const fix = "Fix it in a new PR; the next merge deploys again.";
    const texts = {
        config: `Nothing was deployed: ${where} is unchanged. ${fix}`,
        migrate: `The code on ${where} is unchanged, but check the database: a migration may have partly run. ${fix}`,
        api: `The API on ${where} is still the previous version, and the apps were not touched. ${fix}`,
        apps: `The new API is live on ${where}, but the apps are still the previous version. ${fix}`,
        e2e: `This commit is live on ${where} and failed its tests. Do not release it. ${fix}`,
        check: `This release is live on ${where} and not answering correctly. Check it now; to roll back, see docs/runbook.md.`,
    };
    return texts[failed] ? `**Next:** ${texts[failed]}` : null;
}

/** Facts as sub-bullets; a table or code stays a block of its own (null). */
function subItems(text) {
    if (!text) return [];
    if (/~~~~|^\|/m.test(text)) return null;
    return text.split(/\n| · /).filter(Boolean);
}

const next = (text) => `> [!CAUTION]\n> ${text}`;

export function render(s, marker, now = Date.now()) {
    const state = overall(s);
    const done = state === "success" || state === "failure";
    const time = `${done ? "" : "running for "}${minutes(now - s.startedAt)}`;
    const small = [s.commit && `\`${s.commit.slice(0, 7)}\``, time, `[run](${s.run})`];
    const lines = [
        marker,
        `<!-- state:${JSON.stringify(s)} -->`,
        `### ${ICON[state] ?? "⏳"} ${headline(s, state)}`,
        `<sub>${small.filter(Boolean).join(" · ")}</sub>`,
        "",
    ];
    // What failed first; steps with nothing to do say nothing.
    const order = { failure: 0, running: 1, success: 2, waiting: 3 };
    const shown = s.steps
        .filter(
            (x) =>
                x.state !== "skipped" && (x.state !== "waiting" || x.detail || state === "failure"),
        )
        .sort((a, b) => order[a.state] - order[b.state]);
    const blocks = [];
    for (const x of shown) {
        const facts =
            x.state === "waiting" && !x.detail ? ["did not run"] : (subItems(x.detail) ?? []);
        const section = subItems(s.sections?.[x.id]);
        const subs = section ?? [];
        if (section === null) blocks.push(s.sections[x.id]);
        // One short fact stays on the line; several go under it.
        const inline = facts.length === 1 ? `: ${facts[0]}` : "";
        lines.push(`- ${ICON[x.state] ?? ""} ${x.name}${inline}`);
        for (const sub of [...(inline ? [] : facts), ...subs]) lines.push(`  - ${sub}`);
    }
    if (shown.length) lines.push("");
    for (const block of blocks) {
        if (state === "failure") lines.push(block, "");
        else lines.push("<details><summary>Details</summary>", "", block, "", "</details>", "");
    }
    if (s.sections?._) lines.push(s.sections._, "");
    if (state === "failure" && s.steps.length) {
        const step = nextStep(s);
        if (step) lines.push(next(step), "");
    }
    return lines.join("\n");
}

function areaOf(name) {
    const test = name.replace(/^Test/, "");
    if (/^Sign(In|Out)/.test(test)) return "Sign-in";
    if (/^(Health|Monitoring)/.test(test)) return "Monitoring and health";
    if (/Seller/.test(test)) return "Seller";
    if (/^(Backoffice|Me_Admin)/.test(test)) return "Backoffice";
    return test.split("_")[0];
}

/** `TestBackoffice_EveryTabAnswers` as `Backoffice: every tab answers`. */
function plainName(name) {
    const spaced = (text) => text.replace(/([a-z])([A-Z])/g, "$1 $2");
    const [first, ...rest] = name.replace(/^Test/, "").split("_");
    const words = spaced(rest.join(" ")).toLowerCase();
    return words ? `${spaced(first)}: ${words}` : spaced(first);
}

/** A `go test -v` log as a short line (`detail`) and what to show (`body`). */
export function e2eSummary(log) {
    const failed = [];
    const areas = new Map();
    let total = 0;
    // With -v a test's reasons come before its result line; without it, after.
    let reasons = [];
    let after = null;
    for (const line of log.split("\n")) {
        const why = line.match(/^\s+\S+_test\.go:\d+: (.*)$/);
        if (why) {
            (after ? after.reasons : reasons).push(why[1]);
            continue;
        }
        after = null;
        const result = line.match(/^--- (PASS|FAIL|SKIP): (\S+)/);
        if (!result) continue;
        total++;
        const area = areaOf(result[2]);
        areas.set(area, (areas.get(area) ?? 0) + 1);
        if (result[1] === "FAIL") {
            const test = { name: plainName(result[2]), reasons };
            failed.push(test);
            if (reasons.length === 0) after = test;
        }
        reasons = [];
    }
    if (total === 0) {
        const tail = log.trim().split("\n").slice(-20).join("\n");
        return { detail: "did not run", body: tail ? `~~~~\n${tail}\n~~~~` : "" };
    }
    if (failed.length === 0) {
        const list = [...areas].map(([area, n]) => `${area} ${n}`);
        const rows = [];
        for (let i = 0; i < list.length; i += 3) rows.push(list.slice(i, i + 3).join(", "));
        return { detail: `${total} passed`, body: rows.join("\n") };
    }
    return {
        detail: `${failed.length} of ${total} failed`,
        body: failed
            .map((f) => (f.reasons[0] ? `${f.name}: ${f.reasons[0].slice(0, 200)}` : f.name))
            .join("\n"),
    };
}

export const CHECKS = [
    ["checks", "Format, lint, types, unit tests, build"],
    ["integration", "Integration and E2E tests"],
    ["docker", "Docker images"],
    ["deploy-check", "Deploy check"],
    ["dependency-review", "No risky packages"],
    ["e2e", "E2E"],
    ["previews", "Previews"],
    ["migrations", "Migrations"],
];

/** The one comment before a merge, from `needs`, the preview addresses and why jobs failed. */
export function prComment({ needs, previews = {}, reasons = {}, log = "", toMain = false }) {
    const ran = CHECKS.filter(([id]) => needs[id] && needs[id].result !== "skipped");
    const isFailed = ([id]) => needs[id].result !== "success";
    const failed = ran.filter(isFailed);
    const out = (id, key) => needs[id]?.outputs?.[key];
    const links = Object.entries(previews).map(([app, url]) => `[${app}](${url})`);
    const refused = out("deploy-check", "url");
    const subs = {
        e2e: out("e2e", "detail") ? [out("e2e", "detail")] : [],
        previews: links,
        "deploy-check": refused ? [`[GitHub's exact error](${refused})`] : [],
    };
    const lines = [];
    // What failed first.
    for (const [id, label] of [...failed, ...ran.filter((c) => !isFailed(c))]) {
        lines.push(`- ${isFailed([id]) ? "❌" : "✅"} ${label}`);
        for (const sub of [...(reasons[id] ?? []), ...(subs[id] ?? [])]) lines.push(`  - ${sub}`);
    }
    const bundle = out("checks", "bundle");
    if (bundle) {
        lines.push("- 📦 First screen size");
        for (const app of bundle.split(" · ")) lines.push(`  - ${app}`);
    }
    lines.push("");
    if (out("migrations", "list")) lines.push(out("migrations", "list"), "");
    if (out("benchmark", "body")) {
        lines.push(
            "<details><summary>Speed</summary>",
            "",
            out("benchmark", "body"),
            "",
            "</details>",
            "",
        );
    }
    if (failed.length) {
        lines.push(
            next(
                toMain
                    ? "**Next:** fix it on staging and this PR picks it up. Production is untouched."
                    : "**Next:** fix it on this PR. Nothing has reached staging.",
            ),
            "",
        );
        if (log) lines.push("<details><summary>Full log</summary>", "", log, "", "</details>", "");
    }
    return {
        state: failed.length ? "failure" : "success",
        title: failed.length
            ? `Not ready: ${failed.map(([, label]) => label).join(", ")} failed`
            : toMain
              ? "Ready to release"
              : "Ready to merge",
        body: lines.join("\n"),
    };
}
