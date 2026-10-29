import { SlidersHorizontal } from "lucide-react";

import { ICON } from "../lib/icon";

/** The square button beside a search box that opens a list's filter; a dot while one is set. */
export function FilterButton({
    active,
    label,
    onClick,
}: {
    active: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            aria-label={label}
            className={`relative shrink-0 rounded-xl px-3.5 flex items-center justify-center active:scale-95 ${active ? "bg-brand text-white" : "bg-white text-gray-900"}`}
        >
            <SlidersHorizontal size={ICON} />
        </button>
    );
}
