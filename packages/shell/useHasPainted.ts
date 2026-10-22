import { useEffect, useState } from "react";

// rAF never fires in a hidden tab; without a cap the boot loader would wait
// until the user came back.
const PAINT_MAX_MS = 2000;

/**
 * Whether a frame has painted since mount (two nested frames prove it). Gates
 * the boot loader, so it is seen at least once even when the cached data is
 * there on the first render, instead of appearing and vanishing in one commit.
 */
export function useHasPainted(): boolean {
    const [painted, setPainted] = useState(false);

    useEffect(() => {
        let second = 0;
        const first = requestAnimationFrame(() => {
            second = requestAnimationFrame(() => setPainted(true));
        });
        const cap = setTimeout(() => setPainted(true), PAINT_MAX_MS);
        return () => {
            cancelAnimationFrame(first);
            cancelAnimationFrame(second);
            clearTimeout(cap);
        };
    }, []);

    return painted;
}
