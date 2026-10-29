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
