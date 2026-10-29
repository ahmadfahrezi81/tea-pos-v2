import { createContext, useContext, type RefObject } from "react";

interface ScrollContextValue {
    /** The shell's single scroll container, or null before it mounts. */
    scrollRef: RefObject<HTMLDivElement | null>;
}

export const ScrollContext = createContext<ScrollContextValue>({
    scrollRef: { current: null },
});

/** The shell's scroll region, for an overlay that must keep the user's position while it locks scrolling. */
export function useShellScroll() {
    return useContext(ScrollContext);
}
