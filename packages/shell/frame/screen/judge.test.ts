import { describe, expect, it } from "vitest";

import { judge, type Expect } from "./judge";
import type { Sample } from "./measure";

const STILL: Expect = { headerStill: true, fills: true };

/** A phone 760 px tall at rest: the app fills it, nothing slid. */
const rest = (t: number, over: Partial<Sample> = {}): Sample => ({
    t,
    page: 760,
    visible: 760,
    offset: 0,
    scale: 1,
    scrollY: 0,
    width: 360,
    frameTop: 0,
    frameHeight: 760,
    headerTop: 0,
    keyboard: 0,
    focused: false,
    ...over,
});

describe("judge", () => {
    it("passes Android's shrink: the page and the app shrink, the header stays", () => {
        const run = [
            rest(0),
            rest(40, { focused: true }),
            rest(120, { focused: true, page: 470, visible: 470, frameHeight: 470 }),
            rest(900),
        ];
        const v = judge(run, STILL);
        expect(v.pass).toBe(true);
        expect(v.facts.keyboard).toBe("shrink");
        expect(v.facts.keyboardHeight).toBe(290);
        // 40 → 120 is one movement; 900 comes after a pause, its own.
        expect(v.facts.settleMs).toBe(80);
    });

    it("fails the iPhone's pan for a field at the bottom: the header slid", () => {
        const run = [
            rest(0),
            rest(40, { focused: true, visible: 424, offset: 120, headerTop: -120, frameTop: -120 }),
            rest(300, {
                focused: true,
                visible: 424,
                offset: 336,
                headerTop: -336,
                frameTop: -336,
            }),
            rest(1200),
        ];
        const v = judge(run, STILL);
        expect(v.pass).toBe(false);
        expect(v.facts.keyboard).toBe("pan");
        expect(v.problems).toEqual(["the header moved 336px"]);
    });

    it("passes a keyboard that only covers (a field at the top on the iPhone)", () => {
        const run = [rest(0), rest(50, { focused: true, visible: 424 }), rest(800)];
        const v = judge(run, STILL);
        expect(v.pass).toBe(true);
        expect(v.facts.keyboard).toBe("cover");
    });

    it("fails a screen left slid and short after the photo picker", () => {
        const run = [
            rest(0),
            rest(500, { visible: 700 }),
            rest(1500, { scrollY: 60, frameHeight: 700 }),
        ];
        const v = judge(run, STILL);
        expect(v.pass).toBe(false);
        expect(v.problems).toContain("at the end the page is left scrolled 60px");
        expect(v.problems).toContain("at the end the app is 700px tall, the screen 760px");
    });

    it("does not judge what a pinch zoom or a rotation does", () => {
        const run = [
            rest(0),
            rest(100, { scale: 2, headerTop: -200 }),
            rest(200, { width: 760, headerTop: -50 }),
            rest(400),
        ];
        expect(judge(run, STILL).pass).toBe(true);
    });

    it("leaves the height alone in a browser tab, whose toolbars change it", () => {
        const run = [rest(0), rest(300, { visible: 800 })];
        expect(judge(run, { headerStill: true, fills: false }).pass).toBe(true);
        expect(judge(run, STILL).pass).toBe(false);
    });
});
