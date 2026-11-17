import { CalendarDays, ChevronDown } from "lucide-react";
import type { ComponentType } from "react";

import { ICON } from "../lib/icon";
import { StoreCalendarIcon } from "./StoreCalendarIcon";

/** The white card a picker row sits in. */
export const PICKER_CARD = "overflow-hidden rounded-2xl bg-white";

/**
 * One row of a picker card: what is picked, large, and a line under it; its icon in a tinted box on
 * the right. With `onClick` the whole row is the button and an up-down chevron after the text says so.
 */
export function PickerRow({
    label,
    detail,
    onClick,
    icon: Icon = CalendarDays,
    iconSize = 30,
    heading,
    brand = false,
}: {
    label: string;
    detail?: string;
    onClick?: () => void;
    icon?: ComponentType<{ size?: number; className?: string }>;
    iconSize?: number;
    /** The screen's store, after the date on the same line: as much the heading as the date. */
    heading?: string;
    /** The label a store's name: the brand colour. */
    brand?: boolean;
}) {
    const body = (
        <>
            <span className="flex-1 min-w-0">
                {/* With a heading (the store): "Today Pagelaran"; a long store name gives way first. */}
                <span className="flex items-center gap-1.5">
                    <span
                        className={`${heading ? "shrink-0" : "truncate"} text-[22px] leading-tight font-bold tracking-tight ${brand ? "text-brand" : "text-gray-900"}`}
                    >
                        {label}
                    </span>
                    {heading && (
                        <span className="min-w-0 truncate text-[22px] leading-tight font-bold tracking-tight text-brand">
                            {heading}
                        </span>
                    )}
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
            {/* As tall as the two lines beside it: 27.5 px heading + 20 px line. */}
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-brand/10">
                <Icon size={iconSize} className="text-brand" />
            </span>
        </>
    );
    const row = "w-full flex items-center gap-3 px-4 py-3.5 text-left";
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
    withStore = false,
}: {
    label: string;
    detail?: string;
    onClick: () => void;
    heading?: string;
    /** The sheet picks the store too: the store-and-calendar icon, else the calendar. */
    withStore?: boolean;
}) {
    return (
        <div className={PICKER_CARD}>
            <PickerRow
                label={label}
                detail={detail}
                onClick={onClick}
                heading={heading}
                icon={withStore ? StoreCalendarIcon : CalendarDays}
                iconSize={withStore ? 36 : 30}
            />
        </div>
    );
}
