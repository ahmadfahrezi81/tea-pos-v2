import { X } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A sheet from the bottom of the screen over a dimmed page; a tap outside closes it.
 * Into the page body: a header is its own layer, which would trap a fixed sheet.
 */
export function Sheet({
    open,
    onClose,
    title,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}) {
    if (!open) return null;
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
            <div
                role="dialog"
                aria-label={title}
                className="mx-auto w-full max-w-[480px] max-h-[70vh] overflow-y-auto bg-white rounded-t-2xl px-5 pt-5 pb-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-2">
                    <p className="text-lg font-bold text-gray-900">{title}</p>
                    <button onClick={onClose} className="p-1.5 -mr-2 rounded-full text-gray-900">
                        <X size={24} />
                    </button>
                </div>
                {children}
            </div>
        </div>,
        document.body,
    );
}
