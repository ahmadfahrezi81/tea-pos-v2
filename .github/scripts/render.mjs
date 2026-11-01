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

function headline(s, state) {
    if (state === "success") return s.doneText ?? s.title;
    if (!s.steps.length) return s.title;
    if (state === "failure") {
        const failed = s.steps.filter((x) => x.state === "failure").map((x) => x.name);
        return failed.length ? `${s.title} failed: ${failed.join(", ")}` : `${s.title} failed`;
    }
    return `${s.title}: running`;
}

export function render(s, marker, now = Date.now()) {
    const state = overall(s);
    const done = state === "success" || state === "failure";
    const time = `${done ? "" : "running for "}${minutes(now - s.startedAt)}`;
    const commit = s.commit ? ` · \`${s.commit.slice(0, 7)}\`` : "";
    const lines = [
        marker,
        `<!-- state:${JSON.stringify(s)} -->`,
        `### ${ICON[state] ?? "⏳"} ${headline(s, state)}${commit}`,
        `${time} · [run](${s.run})`,
        "",
    ];
    // What failed first; steps with nothing to do say nothing.
    const order = { failure: 0, running: 1, success: 2, waiting: 3 };
    const shown = s.steps
        .filter((x) => x.state !== "skipped" && (x.state !== "waiting" || state === "failure"))
        .sort((a, b) => order[a.state] - order[b.state]);
    for (const x of shown) {
        const mark = x.state === "success" ? "" : `${ICON[x.state]} `;
        const note = x.state === "waiting" ? "did not run" : (x.detail ?? "");
        lines.push(`- ${mark}**${x.name}**${note ? `: ${note}` : ""}`);
    }
    if (shown.length) lines.push("");
    const sections = s.steps.map((x) => s.sections?.[x.id]).filter(Boolean);
    if (sections.length) {
        if (state === "failure") lines.push(...sections.flatMap((x) => [x, ""]));
        else
            lines.push(
                "<details><summary>Details</summary>",
                "",
                ...sections.flatMap((x) => [x, ""]),
                "</details>",
                "",
            );
    }
    if (s.sections?._) lines.push(s.sections._, "");
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
    const [first, ...rest] = name.replace(/^Test/, "").split("_");
    const words = rest
        .join(" ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase();
    return words ? `${first}: ${words}` : first;
}

/** A `go test -v` log as a short line (`detail`) and what to show (`body`). */
export function e2eSummary(log) {
    const failed = [];
    const areas = new Map();
    let total = 0;
    let reasons = [];
    for (const line of log.split("\n")) {
        const why = line.match(/^\s+\S+_test\.go:\d+: (.*)$/);
        if (why) {
            reasons.push(why[1]);
            continue;
        }
        const result = line.match(/^--- (PASS|FAIL|SKIP): (\S+)/);
        if (!result) continue;
        total++;
        const area = areaOf(result[2]);
        areas.set(area, (areas.get(area) ?? 0) + 1);
        if (result[1] === "FAIL") failed.push({ name: plainName(result[2]), reasons });
        reasons = [];
    }
    if (total === 0) {
        const tail = log.trim().split("\n").slice(-20).join("\n");
        return { detail: "did not run", body: tail ? `~~~~\n${tail}\n~~~~` : "" };
    }
    if (failed.length === 0) {
        const list = [...areas].map(([area, n]) => `${area} ${n}`).join(" · ");
        return { detail: `${total} passed`, body: list };
    }
    return {
        detail: `${failed.length} of ${total} failed`,
        body: failed
            .map((f) =>
                f.reasons.length
                    ? `**${f.name}**\n\n~~~~\n${f.reasons.slice(0, 15).join("\n")}\n~~~~`
                    : `**${f.name}**`,
            )
            .join("\n\n"),
    };
}

const CHECKS = [
    ["checks", "Checks"],
    ["integration", "Tests"],
    ["docker", "Docker"],
    ["dependency-review", "Security"],
    ["e2e", "E2E"],
    ["previews", "Previews"],
    ["migrations", "Migrations"],
];

/** The one comment before a merge, from `needs` and the preview addresses. */
export function prComment({ needs, previews = {}, failures = "", toMain = false }) {
    const ran = CHECKS.filter(([id]) => needs[id] && needs[id].result !== "skipped");
    const failed = ran.filter(([id]) => needs[id].result !== "success");
    const row = ran
        .map(([id, label]) => `${label} ${needs[id].result === "success" ? "✅" : "❌"}`)
        .join(" · ");
    const out = (id, key) => needs[id]?.outputs?.[key];
    const lines = [row, ""];
    const facts = [];
    if (out("e2e", "detail")) facts.push(`E2E: ${out("e2e", "detail")}`);
    if (out("checks", "bundle")) facts.push(`Bundle: ${out("checks", "bundle")}`);
    const links = Object.entries(previews).map(([app, url]) => `[${app}](${url})`);
    if (links.length) facts.push(`Preview: ${links.join(" · ")}`);
    lines.push(...facts.map((f) => `- ${f}`), "");
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
        lines.push(failures, "");
        lines.push(
            toMain
                ? "**Next:** fix it on staging and this PR picks it up. Production is untouched."
                : "**Next:** fix it on this PR. Nothing has reached staging.",
        );
    }
    return {
        state: failed.length ? "failure" : "success",
        title: failed.length
            ? `Not ready: ${failed.map(([, label]) => label).join(", ")}`
            : toMain
              ? "Ready to release"
              : "Ready to merge",
        body: lines.join("\n"),
    };
}
