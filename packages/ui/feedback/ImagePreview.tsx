import { X } from "lucide-react";
import { createPortal } from "react-dom";

import { ICON } from "../lib/icon";
import { usePresence } from "../lib/motion";

/**
 * Any photo, full screen on black: a top bar with what it is and the X, the image fitted below,
 * so the X never sits on the picture. A tap outside the image closes it too.
 */
export function ImagePreview({
    open,
    onClose,
    src,
    title,
}: {
    open: boolean;
    onClose: () => void;
    src: string;
    title: string;
}) {
    const { shown, leaving } = usePresence(open, 120);
    if (!shown) return null;
    return createPortal(
        <div
            role="dialog"
            aria-label={title}
            className={`fixed inset-0 z-50 flex flex-col bg-black pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ${leaving ? "animate-fade-out" : "animate-fade-in"}`}
        >
            <div className="flex items-center gap-3 px-4 py-3">
                <p className="flex-1 min-w-0 truncate font-semibold text-white">{title}</p>
                <button onClick={onClose} className="p-1.5 -mr-1.5 text-white" aria-label={title}>
                    <X size={ICON + 4} />
                </button>
            </div>
            <div className="flex flex-1 min-h-0 items-center justify-center p-2" onClick={onClose}>
                <img
                    src={src}
                    alt={title}
                    className="max-h-full max-w-full object-contain"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        </div>,
        document.body,
    );
}
