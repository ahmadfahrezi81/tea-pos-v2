import type { ReactNode } from "react";

/** A small square-cornered tag on a row: an app and its level, a state. */
export function Pill({ children }: { children: ReactNode }) {
    return (
        <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-gray-900 whitespace-nowrap">
            {children}
        </span>
    );
}
