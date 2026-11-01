// A go test log as this step's `detail` and `body` outputs, for the deploy and release comments.
import { appendFileSync, existsSync, readFileSync } from "node:fs";

import { e2eSummary } from "./render.mjs";

const file = process.argv[2];
const { detail, body } = e2eSummary(existsSync(file) ? readFileSync(file, "utf8") : "");
const mark = `EOF_${Date.now()}`;
appendFileSync(process.env.GITHUB_OUTPUT, `detail=${detail}\nbody<<${mark}\n${body}\n${mark}\n`);
