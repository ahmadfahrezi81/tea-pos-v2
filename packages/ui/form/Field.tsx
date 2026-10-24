import type { ReactNode } from "react";

/** A labelled form field, as the old apps: the label in small capitals, the control under it. */
export function Field({
    label,
    required,
    children,
}: {
    label: ReactNode;
    required?: boolean;
    children: ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
                {label}
                {required && <span className="text-red-500"> *</span>}
            </p>
            {children}
        </div>
    );
}
