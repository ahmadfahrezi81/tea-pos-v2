import type { ReactNode } from "react";

/** The old seller app's details card: a label over each value, a divider between. */
export function DetailList({ children }: { children: ReactNode }) {
    return <div className="bg-white rounded-2xl px-4">{children}</div>;
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="py-4 border-b border-gray-100 last:border-none">
            <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
            <div className="text-base text-gray-900 font-medium">{children}</div>
        </div>
    );
}

/** A tight card of `InfoRow`s, as a payslip's details. */
export function InfoList({ children }: { children: ReactNode }) {
    return <div className="bg-white rounded-2xl px-4 py-3 space-y-2.5">{children}</div>;
}

/** One line: the label on the left, the value on the right, cut short rather than wrapped. */
export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 text-[15px] text-gray-900">
            <span className="shrink-0">{label}</span>
            <span className="min-w-0 truncate text-right font-medium">{children}</span>
        </div>
    );
}
