import type { ReactNode } from "react";

const TONES = {
    neutral: "bg-slate-100 text-gray-900",
    brand: "bg-brand/10 text-brand",
    blue: "bg-blue-50 text-blue-700",
    dark: "bg-gray-900 text-white",
    red: "bg-red-50 text-red-600",
};

/** A small tag on a row: an app and its level, a state; readable at a glance. */
export function Pill({
    tone = "neutral",
    children,
}: {
    tone?: keyof typeof TONES;
    children: ReactNode;
}) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TONES[tone]}`}
        >
            {children}
        </span>
    );
}
