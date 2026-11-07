import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { ICON } from "@tea-pos/ui/icon";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";

/**
 * The old apps' menu rows (More, Pay, the Store overview): an icon, a label, an orange chevron,
 * a divider under every row but the last. A row goes to `to`, or does `onClick`.
 */
export function SettingsRow({
    icon,
    label,
    sublabel,
    to,
    search,
    onClick,
    right,
    dot,
    danger,
    below,
}: {
    icon: ReactNode;
    label: string;
    sublabel?: ReactNode;
    to?: string;
    /** The address's search, for `to`. */
    search?: Record<string, string>;
    onClick?: () => void;
    /** Replaces the chevron: a toggle, a badge, a value. */
    right?: ReactNode;
    /** A brand dot before the chevron: something new inside. */
    dot?: boolean;
    /** The label in red: an ending, as Close Day. */
    danger?: boolean;
    /** A second action inside the same row, under its label (App info's Update now). */
    below?: ReactNode;
}) {
    const inner = (
        <>
            <span className="text-xl w-6 text-center shrink-0 flex items-center py-5">{icon}</span>
            <div
                className={`flex-1 min-w-0 flex items-center gap-2 py-5 -mr-4 pr-4 ${below ? "pb-4" : "border-b-2 border-slate-100 group-last:border-b-0"}`}
            >
                <div className="flex-1 min-w-0">
                    <p
                        className={`text-[17px] font-medium ${danger ? "text-red-600" : "text-gray-800"}`}
                    >
                        {label}
                    </p>
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
    const className = `${below ? "" : "group "}w-full flex items-stretch gap-3 text-left active:bg-gray-50`;
    const row = to ? (
        <Link to={to} search={search as never} className={className}>
            {inner}
        </Link>
    ) : (
        <button onClick={onClick} className={className}>
            {inner}
        </button>
    );
    if (!below) return row;
    return (
        <div className="group">
            {row}
            <div className="-mr-4 pr-4 pt-4 pb-4 border-t-2 border-b-2 border-slate-100 group-last:border-b-0">
                {below}
            </div>
        </div>
    );
}

/** A titled card of `SettingsRow`s; the dividers come from the rows. */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
    return (
        <section className="space-y-2">
            {title && <SectionLabel>{title}</SectionLabel>}
            <div className="bg-white rounded-2xl px-4 py-1 in-[.sheet]:p-0">{children}</div>
        </section>
    );
}

/** The red Log Out at the foot of a page: Account's, and a person's. */
export function LogOutButton({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="bg-red-500 text-white py-3 px-16 rounded-xl font-semibold text-base active:scale-[0.98] transition-transform"
        >
            {label}
        </button>
    );
}

/** A row's icon, as the old apps draw them. */
export const rowIcon = { size: ICON, strokeWidth: 2, className: "text-gray-900" } as const;
