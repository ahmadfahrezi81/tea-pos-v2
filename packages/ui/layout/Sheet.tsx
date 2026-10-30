import { ArrowLeft, X } from "lucide-react";
import type { ReactNode } from "react";

import { Drawer, DrawerHandle } from "./Drawer";

/**
 * The old apps' bottom sheet: a pull tab, a bold title (and what sits beside it), a close
 * button, the content scrolling below. Lists inside (`.sheet`) drop their card padding, so they
 * line up with the title. A nested sheet passes `onBack`: an arrow beside the title, as the header.
 */
export function Sheet({
    open,
    onClose,
    title,
    beside,
    onBack,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    /** Next to the title: a switch, a count. */
    beside?: ReactNode;
    /** Back to the sheet this one opened from. */
    onBack?: () => void;
    children: ReactNode;
}) {
    return (
        <Drawer open={open} onClose={onClose} label={title} className="px-4 pt-5 pb-2.5">
            <DrawerHandle />
            <div data-drag className="flex items-center justify-between mb-4 touch-none">
                <div className="flex items-center gap-3 min-w-0">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="-ml-1 p-1 text-gray-900 active:opacity-70"
                            aria-label={title}
                        >
                            <ArrowLeft size={26} />
                        </button>
                    )}
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
            <div className="sheet -mx-4 px-4 max-h-[60vh] overflow-y-auto overflow-x-hidden">
                {children}
            </div>
        </Drawer>
    );
}
