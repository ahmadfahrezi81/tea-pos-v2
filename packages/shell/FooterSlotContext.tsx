import { createContext, useContext, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** The shell's footer region. Null until the shell has mounted. */
export const FooterSlotContext = createContext<HTMLElement | null>(null);

/**
 * Renders a page's footer (a save button) into the shell, above the tab nav. A
 * portal, not shell state: storing a page's node in the shell caused an update loop.
 */
export function FooterSlot({ children }: { children: ReactNode }) {
    const target = useContext(FooterSlotContext);

    // Marks the slot so the shell paints the footer white; CSS :has() missed the portal filling it later.
    useEffect(() => {
        if (!target) return;
        target.classList.add("is-occupied");
        return () => target.classList.remove("is-occupied");
    }, [target]);

    return target ? createPortal(children, target) : null;
}
