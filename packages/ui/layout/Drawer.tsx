import { type PointerEvent as ReactPointerEvent, type ReactNode, useRef } from "react";
import { createPortal } from "react-dom";

import { usePresence } from "../lib/motion";

/**
 * A panel up from the bottom over a dimmed page; a tap outside closes it. It slides in and,
 * while `open` turns false, slides out before it goes. Into the page body: a header is its own
 * layer, which would trap a fixed panel. Every bottom sheet is built on it; it alone adds the phone's
 * home bar gap, so a sheet's own padding is only its design. Pulling its handle (or anything marked
 * `data-drag`) down closes it; the wrapper follows the finger, so the slide out starts from there.
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
    const wrapper = useRef<HTMLDivElement>(null);
    if (!shown) return null;

    const startDrag = (e: ReactPointerEvent) => {
        const target = e.target as Element;
        const el = wrapper.current;
        if (!el || !target.closest("[data-drag]") || target.closest("button")) return;
        const { clientY: y0, timeStamp: t0 } = e;
        let dy = 0;
        const back = () => {
            el.style.transition = "transform 200ms ease-out";
            el.style.transform = "";
        };
        const move = (m: PointerEvent) => {
            dy = Math.max(0, m.clientY - y0);
            el.style.transition = "none";
            el.style.transform = `translateY(${dy}px)`;
        };
        const end = (u: PointerEvent) => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", end);
            window.removeEventListener("pointercancel", end);
            if (u.type === "pointerup" && (dy > 80 || (dy > 20 && dy / (u.timeStamp - t0) > 0.5))) {
                onClose();
                // Still here after the slide out: the screen kept it open.
                setTimeout(back, 250);
            } else back();
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
            <div
                aria-hidden
                className={`absolute inset-0 ${dim} ${leaving ? "animate-fade-out" : "animate-fade-in"}`}
            />
            <div ref={wrapper} className="relative mx-auto w-full max-w-[480px]">
                <div
                    role="dialog"
                    aria-label={label}
                    className={`overflow-x-hidden bg-white rounded-t-2xl pb-[env(safe-area-inset-bottom)] ${leaving ? "animate-sheet-out" : "animate-sheet-in"}`}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={startDrag}
                >
                    <div className={className}>{children}</div>
                </div>
            </div>
        </div>,
        document.body,
    );
}

/** The grab handle at a drawer's top. */
export function DrawerHandle() {
    return (
        <div
            data-drag
            className="absolute top-0 left-0 right-0 flex justify-center pt-2 pb-3 touch-none"
        >
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
