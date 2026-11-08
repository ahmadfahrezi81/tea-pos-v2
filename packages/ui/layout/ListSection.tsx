import type { ReactNode } from "react";

import { SectionLabel } from "./SectionLabel";

/** A core's list (its cards) as one group, so it reads apart from the menu rows under it. */
export function ListSection({
    title,
    count,
    framed = false,
    children,
}: {
    title: string;
    count?: number;
    /** A thin grey frame around the cards too, as the Store home's latest orders. */
    framed?: boolean;
    children: ReactNode;
}) {
    return (
        <section className="space-y-2">
            <SectionLabel>{count === undefined ? title : `${title} (${count})`}</SectionLabel>
            <div
                className={`rounded-2xl bg-slate-200/70 ${framed ? "p-1 space-y-1" : "space-y-2"}`}
            >
                {children}
            </div>
        </section>
    );
}
