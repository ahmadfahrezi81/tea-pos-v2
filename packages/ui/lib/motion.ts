import { useEffect, useState } from "react";

/**
 * Keeps something on screen while its exit animation plays. `shown` is whether to render it,
 * `leaving` whether to give it the `-out` animation; `ms` matches that animation's length.
 */
export function usePresence(open: boolean, ms = 200): { shown: boolean; leaving: boolean } {
    const [shown, setShown] = useState(open);
    if (open && !shown) setShown(true);
    useEffect(() => {
        if (open || !shown) return;
        const id = setTimeout(() => setShown(false), ms);
        return () => clearTimeout(id);
    }, [open, shown, ms]);
    return { shown, leaving: shown && !open };
}
