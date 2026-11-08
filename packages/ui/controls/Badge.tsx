import type { ReactNode } from "react";

const TONE = {
    slate: "bg-slate-100 text-gray-900",
    // The apps' brand colours: Tea-Seller blue, Tea-Office orange.
    blue: "bg-blue-100 text-blue-800",
    orange: "bg-orange-100 text-orange-800",
} as const;

/** A small square-cornered tag on a row: an app and its level, a state. */
export function Badge({
    tone = "slate",
    children,
}: {
    tone?: keyof typeof TONE;
    children: ReactNode;
}) {
    return (
        <span
            className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE[tone]}`}
        >
            {children}
        </span>
    );
}
