import { X } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The old apps' bottom sheet: a pull tab, a bold title (and what sits beside it), a close
 * button, over a dimmed page; a tap outside closes it. Into the page body: a header is its own
 * layer, which would trap a fixed sheet.
 */
export function Sheet({
    open,
    onClose,
    title,
    beside,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    /** Next to the title: a switch, a count. */
    beside?: ReactNode;
    children: ReactNode;
}) {
    if (!open) return null;
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
            <div
                role="dialog"
                aria-label={title}
                className="relative mx-auto w-full max-w-[480px] bg-white rounded-t-2xl px-4 pt-5 pb-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute top-2 left-0 right-0 flex justify-center">
                    <div className="w-8 h-1 rounded-full bg-gray-300" />
                </div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <p className="text-xl font-bold text-gray-900">{title}</p>
                        {beside}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full text-gray-900 hover:bg-gray-100 -mr-2"
                    >
                        <X size={26} />
                    </button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto">{children}</div>
            </div>
        </div>,
        document.body,
    );
}
