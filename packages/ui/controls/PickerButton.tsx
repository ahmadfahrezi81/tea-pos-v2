import { CalendarDays, ChevronDown } from "lucide-react";

import { ICON } from "../lib/icon";

/** A screen's heading that is also its date picker: what is picked, the days under it; a tap opens the sheet. */
export function PickerButton({
    label,
    detail,
    onClick,
}: {
    label: string;
    detail?: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 text-left active:bg-gray-50"
        >
            <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1">
                    <span className="text-[22px] leading-tight font-bold tracking-tight text-gray-900 truncate">
                        {label}
                    </span>
                    <ChevronDown size={ICON} strokeWidth={2.5} className="text-brand/90 shrink-0" />
                </span>
                {detail && (
                    <span className="block text-sm font-medium text-gray-900 truncate">
                        {detail}
                    </span>
                )}
            </span>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                <CalendarDays size={ICON} className="text-brand" />
            </span>
        </button>
    );
}
