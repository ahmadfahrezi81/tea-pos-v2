import type { ReactNode } from "react";

import { SectionLabel } from "./SectionLabel";

/** A core's list (its cards) as one group, so it reads apart from the menu rows under it. */
export function ListSection({
    title,
    count,
    children,
}: {
    title: string;
    count?: number;
    children: ReactNode;
}) {
    return (
        <section className="space-y-2">
            <SectionLabel>{count === undefined ? title : `${title} (${count})`}</SectionLabel>
            <div className="rounded-2xl bg-slate-200/70 p-1.5 space-y-1.5">{children}</div>
        </section>
    );
}
