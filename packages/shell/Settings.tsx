import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { ICON } from "@tea-pos/ui/icon";

/**
 * The old apps' menu rows (More, Pay, the Store overview): an icon, a label, an orange chevron,
 * a divider under every row but the last. A row goes to `to`, or does `onClick`.
 */
export function SettingsRow({
    icon,
    label,
    sublabel,
    to,
    onClick,
    right,
    dot,
}: {
    icon: ReactNode;
    label: string;
    sublabel?: string;
    to?: string;
    onClick?: () => void;
    /** Replaces the chevron: a toggle, a badge, a value. */
    right?: ReactNode;
    /** A brand dot before the chevron: something new inside. */
    dot?: boolean;
}) {
    const inner = (
        <>
            <span className="text-xl w-6 text-center shrink-0 flex items-center py-5">{icon}</span>
            <div className="flex-1 min-w-0 flex items-center gap-2 py-5 -mr-4 pr-4 border-b-2 border-slate-100 group-last:border-b-0">
                <div className="flex-1 min-w-0">
                    <p className="text-[17px] font-medium text-gray-800">{label}</p>
                    {sublabel && <p className="text-xs text-gray-500 truncate">{sublabel}</p>}
                </div>
                {dot && <span className="size-2 rounded-full bg-brand shrink-0" />}
                {right ?? (
                    <ChevronRight
                        size={ICON}
                        strokeWidth={2.5}
                        className="text-brand/90 shrink-0"
                    />
                )}
            </div>
        </>
    );
    const className = "group w-full flex items-stretch gap-3 text-left active:bg-gray-50";
    return to ? (
        <Link to={to} className={className}>
            {inner}
        </Link>
    ) : (
        <button onClick={onClick} className={className}>
            {inner}
        </button>
    );
}

/** A titled card of `SettingsRow`s; the dividers come from the rows. */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
    return (
        <section className="space-y-2">
            {title && (
                <p className="pl-3 text-xs font-bold uppercase tracking-widest text-gray-700">
                    {title}
                </p>
            )}
            <div className="bg-white rounded-2xl px-4 py-1">{children}</div>
        </section>
    );
}

/** A row's icon, as the old apps draw them. */
export const rowIcon = { size: ICON, strokeWidth: 2, className: "text-gray-900" } as const;
