import type { ReactNode } from "react";

/**
 * A tinted block around related groups, with a heading of its own: everything inside is about one
 * thing (a person's apps, their stores).
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
        <section className="rounded-3xl bg-slate-200/70 p-3 space-y-3">
            <div className="flex items-center gap-2 px-1 pt-1 text-gray-900">
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
        <p className="pl-2 text-xs font-bold uppercase tracking-widest text-gray-700">{children}</p>
    );
}
