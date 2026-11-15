import { CalendarDays, ChevronDown, type LucideIcon } from "lucide-react";

import { ICON } from "../lib/icon";

/**
 * One row of a picker card: what is picked, large, and a line under it; its icon in a tinted box on
 * the right. With `onClick` the whole row is the button and a chevron says so; without, a plain label.
 */
export function PickerRow({
    label,
    detail,
    onClick,
    icon: Icon = CalendarDays,
    heading,
    brand = false,
}: {
    label: string;
    detail?: string;
    onClick?: () => void;
    icon?: LucideIcon;
    /** A first line as large as the label: the screen's store, as much the heading as the date. */
    heading?: string;
    /** The label a store's name: the brand colour, the size it has beside a date. */
    brand?: boolean;
}) {
    const body = (
        <>
            <span className="flex-1 min-w-0">
                {/* With a heading (the store), both share the line a little smaller: "Pagelaran · Thu 12 Nov"; a long store name gives way first. */}
                <span className="flex items-center gap-1">
                    {heading && (
                        <>
                            <span className="min-w-0 truncate text-[19px] leading-tight font-bold tracking-tight text-brand">
                                {heading}
                            </span>
                            <span className="shrink-0 text-[19px] leading-tight font-bold text-gray-400">
                                ·
                            </span>
                        </>
                    )}
                    <span
                        className={`${heading ? "shrink-0 text-[19px]" : brand ? "truncate text-[19px]" : "truncate text-[22px]"} leading-tight font-bold tracking-tight ${brand ? "text-brand" : "text-gray-900"}`}
                    >
                        {label}
                    </span>
                    {onClick && (
                        <ChevronDown
                            size={ICON}
                            strokeWidth={2.5}
                            className="text-brand/90 shrink-0"
                        />
                    )}
                </span>
                {detail && (
                    <span className="block text-sm font-medium text-gray-900 truncate">
                        {detail}
                    </span>
                )}
            </span>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                <Icon size={ICON} className="text-brand" />
            </span>
        </>
    );
    const row = "w-full flex items-center gap-2 px-3 py-2.5 text-left";
    return onClick ? (
        <button onClick={onClick} className={`${row} active:bg-gray-50`}>
            {body}
        </button>
    ) : (
        <div className={row}>{body}</div>
    );
}

/** A screen's heading that is also its date picker (and its store's, through the sheet), in a white card. */
export function PickerButton({
    label,
    detail,
    onClick,
    heading,
}: {
    label: string;
    detail?: string;
    onClick: () => void;
    heading?: string;
}) {
    return (
        <div className="overflow-hidden rounded-2xl bg-white">
            <PickerRow label={label} detail={detail} onClick={onClick} heading={heading} />
        </div>
    );
}
