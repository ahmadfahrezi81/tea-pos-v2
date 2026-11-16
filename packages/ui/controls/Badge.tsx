import type { ReactNode } from "react";

const TONE = {
    slate: "bg-slate-100 text-gray-900",
    // The apps' brand colours: Tea-Seller blue, Tea-Office orange.
    blue: "bg-blue-100 text-blue-800",
    orange: "bg-orange-100 text-orange-800",
    // The screen's brand colour, solid (chat's VIP: its violet).
    brand: "bg-brand text-slate-100",
} as const;

/** A small square-cornered tag on a row: an app and its level, a state. */
export function Badge({
    tone = "slate",
    size = "md",
    children,
}: {
    tone?: keyof typeof TONE;
    /** `sm`: beside a small name (chat's VIP). */
    size?: "md" | "sm";
    children: ReactNode;
}) {
    return (
        <span
            className={`inline-flex items-center rounded-sm font-semibold whitespace-nowrap ${size === "sm" ? "px-1 text-[10px] leading-4" : "px-1.5 py-0.5 text-xs"} ${TONE[tone]}`}
        >
            {children}
        </span>
    );
}
