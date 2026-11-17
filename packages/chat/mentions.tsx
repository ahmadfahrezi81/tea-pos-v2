import type { ReactNode } from "react";

/**
 * A message's text with its @mentions lit (RFC: mentions are highlighted on the phone only):
 * `@` and a member's full name, or `@everyone`, as it looked typed in the box.
 */
export function withMentions(text: string, names: string[], inBox = false): ReactNode {
    const all = [...new Set([...names, "everyone"])]
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);
    if (!text.includes("@") || all.length === 0) return text;
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`@(${all.map(escape).join("|")})`, "g");
    const out: ReactNode[] = [];
    let last = 0;
    for (const hit of text.matchAll(re)) {
        const at = hit.index ?? 0;
        if (at > last) out.push(text.slice(last, at));
        const who = hit[1]!;
        out.push(
            <span
                key={at}
                // The name in the brand green, bold. In the box a stroke instead of weight, so
                // no letter moves away from the caret.
                className={
                    inBox
                        ? "text-brand [-webkit-text-stroke:0.7px_currentColor]"
                        : "font-semibold text-brand"
                }
            >
                @{who}
            </span>,
        );
        last = at + hit[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}
