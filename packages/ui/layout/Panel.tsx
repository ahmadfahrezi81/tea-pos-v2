import type { ReactNode } from "react";
import { SectionLabel } from "./SectionLabel";

/**
 * A heading over a white card around related groups: everything inside is about one thing (a
 * person's apps, their stores). Cards inside turn grey, as v1's analytics cards; lists opt in
 * with `in-[.panel]:`.
 */
export function Panel({
    title,
    beside,
    children,
}: {
    title: string;
    /** At the heading's right: a badge, a count. */
    beside?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="space-y-2">
            <div className="flex items-center gap-2 pr-1">
                <div className="flex-1 min-w-0">
                    <SectionLabel>{title}</SectionLabel>
                </div>
                {beside}
            </div>
            <div className="panel rounded-2xl bg-white p-4 space-y-3">{children}</div>
        </section>
    );
}

/** A small heading over a card inside a Panel. */
export function PanelLabel({ children }: { children: ReactNode }) {
    return <SectionLabel inset={false}>{children}</SectionLabel>;
}
