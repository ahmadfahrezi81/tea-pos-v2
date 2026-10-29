import type { ReactNode } from "react";

/**
 * A white card around related groups, with a heading of its own: everything inside is about one
 * thing (a person's apps, their stores). Cards inside turn grey, as v1's analytics cards; lists
 * opt in with `in-[.panel]:`.
 */
export function Panel({
    icon,
    title,
    children,
}: {
    icon?: ReactNode;
    title: string;
    children: ReactNode;
}) {
    return (
        <section className="panel rounded-2xl bg-white p-4 space-y-3">
            <div className="flex items-center gap-2 text-gray-900">
                {icon}
                <h2 className="text-lg font-bold">{title}</h2>
            </div>
            {children}
        </section>
    );
}

/** A small heading over a card inside a Panel. */
export function PanelLabel({ children }: { children: ReactNode }) {
    return (
        <p className="pl-1 text-xs font-bold uppercase tracking-widest text-gray-700">{children}</p>
    );
}
