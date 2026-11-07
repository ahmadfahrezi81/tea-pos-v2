import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Sheet } from "../layout/Sheet";
import { MonthGrid } from "./MonthGrid";

/** A ‹ › button for stepping through periods: a grey square with a bold chevron. */
export const STEP_ARROW =
    "size-11 shrink-0 flex items-center justify-center rounded-xl bg-slate-100 text-gray-900 active:scale-95 active:bg-slate-200 disabled:opacity-30";
export const stepIcon = { size: 26, strokeWidth: 2.75 } as const;

/** The first month with any data (the business began then): no picker goes before it. */
export const FIRST_MONTH = "2025-08";
export const FIRST_DAY = `${FIRST_MONTH}-01`;
/** Pay (payouts, claims) began later. */
export const FIRST_PAY_MONTH = "2026-06";
export const FIRST_PAY_DAY = `${FIRST_PAY_MONTH}-01`;

/**
 * The old backoffice's month bar: ‹ the month ›. Months are "YYYY-MM"; the label is the caller's.
 * With `pick`, a tap on the label opens the months in a sheet; nothing after `pick.today`'s month.
 */
export function MonthStepper({
    month,
    label,
    onChange,
    pick,
    first = FIRST_MONTH,
}: {
    month: string;
    label: string;
    onChange: (month: string) => void;
    pick?: { title: string; today: string; locale: string };
    /** The earliest month it goes to. */
    first?: string;
}) {
    const [open, setOpen] = useState(false);
    const step = (by: number) => {
        const [y, m] = month.split("-").map(Number);
        const d = new Date(Date.UTC(y!, m! - 1 + by, 1));
        onChange(d.toISOString().slice(0, 7));
    };
    return (
        <div className="flex items-center justify-between gap-2 bg-white rounded-xl px-2 py-1.5">
            <button
                onClick={() => step(-1)}
                disabled={month <= first}
                className={STEP_ARROW}
                aria-label="‹"
            >
                <ChevronLeft {...stepIcon} />
            </button>
            {pick ? (
                <button
                    onClick={() => setOpen(true)}
                    className="flex min-w-0 items-center gap-1 rounded-lg px-2 py-1 text-lg font-semibold text-gray-900 active:bg-slate-100"
                >
                    <span className="truncate">{label}</span>
                    <ChevronDown size={18} strokeWidth={2.5} className="shrink-0 text-gray-500" />
                </button>
            ) : (
                <p className="text-lg font-semibold text-gray-900">{label}</p>
            )}
            <button
                onClick={() => step(1)}
                disabled={!!pick && month >= pick.today.slice(0, 7)}
                className={STEP_ARROW}
                aria-label="›"
            >
                <ChevronRight {...stepIcon} />
            </button>
            {pick && (
                <Sheet open={open} onClose={() => setOpen(false)} title={pick.title}>
                    <MonthGrid
                        // Opens on the shown month's year each time.
                        key={String(open)}
                        value={month}
                        first={first}
                        today={pick.today}
                        locale={pick.locale}
                        onPick={(m) => {
                            onChange(m);
                            setOpen(false);
                        }}
                    />
                </Sheet>
            )}
        </div>
    );
}
