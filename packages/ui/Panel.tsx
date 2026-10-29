import type { ReactNode } from "react";
import { SectionLabel } from "./SectionLabel";

/**
 * A white card around related groups, with a heading of its own: everything inside is about one
 * thing (a person's apps, their stores). Cards inside turn grey, as v1's analytics cards; lists
 * opt in with `in-[.panel]:`.
 */
export function Panel({
    icon,
    title,
    beside,
    children,
}: {
    icon?: ReactNode;
    title: string;
    /** At the heading's right: a badge, a count. */
    beside?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="panel rounded-2xl bg-white p-4 space-y-3">
            <div className="flex items-center gap-2 text-gray-900">
                {icon}
                <h2 className="flex-1 text-lg font-bold">{title}</h2>
                {beside}
            </div>
            {children}
        </section>
    );
}

/** A small heading over a card inside a Panel. */
export function PanelLabel({ children }: { children: ReactNode }) {
    return <SectionLabel inset={false}>{children}</SectionLabel>;
}
