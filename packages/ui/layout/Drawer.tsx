import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { usePresence } from "../lib/motion";

/**
 * A panel up from the bottom over a dimmed page; a tap outside closes it. It slides in and,
 * while `open` turns false, slides out before it goes. Into the page body: a header is its own
 * layer, which would trap a fixed panel. Every bottom sheet is built on it; it alone adds the phone's
 * home bar gap, so a sheet's own padding is only its design.
 */
export function Drawer({
    open = true,
    onClose,
    dim = "bg-black/60",
    className = "",
    label,
    children,
}: {
    open?: boolean;
    onClose: () => void;
    /** The backdrop's colour. */
    dim?: string;
    /** The panel's padding and spacing. */
    className?: string;
    label?: string;
    children: ReactNode;
}) {
    const { shown, leaving } = usePresence(open);
    if (!shown) return null;
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
            <div
                aria-hidden
                className={`absolute inset-0 ${dim} ${leaving ? "animate-fade-out" : "animate-fade-in"}`}
            />
            <div
                role="dialog"
                aria-label={label}
                className={`relative mx-auto w-full max-w-[480px] overflow-x-hidden bg-white rounded-t-2xl pb-[env(safe-area-inset-bottom)] ${leaving ? "animate-sheet-out" : "animate-sheet-in"}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={className}>{children}</div>
            </div>
        </div>,
        document.body,
    );
}

/** The grab handle at a drawer's top. */
export function DrawerHandle() {
    return (
        <div className="absolute top-2 left-0 right-0 flex justify-center">
            <div className="w-8 h-1 rounded-full bg-gray-300" />
        </div>
    );
}

/** A card in the middle of the screen over a dark page: pops in and out. */
export function Dialog({
    open = true,
    onClose,
    dim = "bg-black/80",
    className = "",
    label,
    children,
}: {
    open?: boolean;
    onClose: () => void;
    dim?: string;
    className?: string;
    label?: string;
    children: ReactNode;
}) {
    const { shown, leaving } = usePresence(open, 120);
    if (!shown) return null;
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                aria-hidden
                className={`absolute inset-0 ${dim} ${leaving ? "animate-fade-out" : "animate-fade-in"}`}
            />
            <div
                role="dialog"
                aria-label={label}
                className={`relative ${leaving ? "animate-pop-out" : "animate-pop-in"} ${className}`}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}
