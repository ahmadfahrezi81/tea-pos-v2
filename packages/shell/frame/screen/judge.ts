import { SETTLE_MS, type Sample } from "./measure";

/**
 * The lab's judge (task 073): plain functions over a recorded run, the same rules on every
 * phone, tested off the phone with recorded runs (judge.test.ts).
 */

/** Within this, two lengths are the same (rounding, a hairline). */
const TOLERANCE = 1;
/** A keyboard is at least this tall; less is a toolbar. */
const MIN_KEYBOARD = 120;

export interface Expect {
    /**
     * The header must not move while the case runs: an app screen (chat, search, a form). A
     * focus screen (a code at the bottom of the screen) may slide it away to fit the field.
     */
    headerStill: boolean;
    /** The app must fill the screen at the end: installed only (a tab's toolbars change it). */
    fills: boolean;
}

export interface Verdict {
    pass: boolean;
    /** Why it failed, one line each; empty when it passed. */
    problems: string[];
    facts: {
        /** How the phone made room for a keyboard, if one opened. */
        keyboard: "none" | "shrink" | "pan" | "cover";
        keyboardHeight: number;
        headerMovedBy: number;
        /** The longest single movement, ms (a keyboard opening, the screen coming back). */
        settleMs: number;
        end: Pick<Sample, "page" | "visible" | "offset" | "scrollY" | "frameTop" | "frameHeight">;
    };
}

/** Zoomed in, or turning: not the layout's doing, so not judged. */
const ignored = (s: Sample, first: Sample) => s.scale > 1.01 || s.width !== first.width;

export function judge(samples: Sample[], expect: Expect): Verdict {
    const first = samples[0]!;
    const last = samples.at(-1)!;
    const judged = samples.filter((s) => !ignored(s, first));
    const problems: string[] = [];

    const keyboardHeight = Math.max(
        0,
        ...judged.map((s) => Math.max(first.visible - s.visible, s.keyboard)),
    );
    const shrank = judged.some((s) => first.page - s.page > MIN_KEYBOARD);
    const panned = judged.some((s) => s.offset > TOLERANCE || s.scrollY > TOLERANCE);
    const keyboard: Verdict["facts"]["keyboard"] =
        keyboardHeight < MIN_KEYBOARD ? "none" : shrank ? "shrink" : panned ? "pan" : "cover";

    const headerMovedBy = Math.max(
        0,
        ...judged.map((s) => Math.abs(s.headerTop - first.headerTop)),
    );
    if (expect.headerStill && headerMovedBy > TOLERANCE)
        problems.push(`the header moved ${headerMovedBy}px`);

    // Every kind of screen: a field being typed in is never under the keyboard.
    const hidden = Math.max(
        0,
        ...judged
            .filter((s) => s.focused && first.visible - s.visible >= MIN_KEYBOARD)
            .map((s) => s.fieldBottom - s.visible),
    );
    if (hidden > TOLERANCE) problems.push(`the field was ${hidden}px under the keyboard`);

    // After the case: the app fills what is visible, from its top, and nothing is left slid.
    if (expect.fills && Math.abs(last.frameHeight - last.visible) > TOLERANCE)
        problems.push(
            `at the end the app is ${last.frameHeight}px tall, the screen ${last.visible}px`,
        );
    if (Math.abs(last.frameTop) > TOLERANCE)
        problems.push(`at the end the app starts ${last.frameTop}px down`);
    if (last.scrollY > TOLERANCE)
        problems.push(`at the end the page is left scrolled ${last.scrollY}px`);
    if (last.offset > TOLERANCE)
        problems.push(`at the end the screen is left slid ${last.offset}px`);

    // The longest movement: changes closer than SETTLE_MS are one movement (a keyboard opening).
    let settleMs = 0;
    let from = samples[1]?.t ?? 0;
    for (let i = 2; i < samples.length; i++) {
        if (samples[i]!.t - samples[i - 1]!.t > SETTLE_MS) from = samples[i]!.t;
        settleMs = Math.max(settleMs, samples[i]!.t - from);
    }

    return {
        pass: problems.length === 0,
        problems,
        facts: {
            keyboard,
            keyboardHeight,
            headerMovedBy,
            settleMs,
            end: {
                page: last.page,
                visible: last.visible,
                offset: last.offset,
                scrollY: last.scrollY,
                frameTop: last.frameTop,
                frameHeight: last.frameHeight,
            },
        },
    };
}
