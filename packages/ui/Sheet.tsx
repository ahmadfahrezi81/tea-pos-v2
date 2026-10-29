import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Drawer, DrawerHandle } from "./Drawer";

/**
 * The old apps' bottom sheet: a pull tab, a bold title (and what sits beside it), a close
 * button, the content scrolling below.
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
    return (
        <Drawer open={open} onClose={onClose} label={title} className="px-4 pt-5 pb-5">
            <DrawerHandle />
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
            <div className="-mx-4 px-4 max-h-[60vh] overflow-y-auto overflow-x-hidden">
                {children}
            </div>
        </Drawer>
    );
}
