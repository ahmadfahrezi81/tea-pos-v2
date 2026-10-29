import type { ReactNode } from "react";
import { SectionLabel } from "../SectionLabel";

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
            <SectionLabel inset={false}>
                {label}
                {required && <span className="text-red-500"> *</span>}
            </SectionLabel>
            {children}
        </div>
    );
}
