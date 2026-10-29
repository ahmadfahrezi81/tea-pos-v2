import { ChevronLeft, ChevronRight } from "lucide-react";

/** A ‹ › button for stepping through periods: a grey square with a bold chevron. */
export const STEP_ARROW =
    "size-11 shrink-0 flex items-center justify-center rounded-xl bg-slate-100 text-gray-900 active:scale-95 active:bg-slate-200";
export const stepIcon = { size: 26, strokeWidth: 2.75 } as const;

/** The old backoffice's month bar: ‹ the month › . Months are "YYYY-MM"; the label is the caller's. */
export function MonthStepper({
    month,
    label,
    onChange,
}: {
    month: string;
    label: string;
    onChange: (month: string) => void;
}) {
    const step = (by: number) => {
        const [y, m] = month.split("-").map(Number);
        const d = new Date(Date.UTC(y!, m! - 1 + by, 1));
        onChange(d.toISOString().slice(0, 7));
    };
    return (
        <div className="flex items-center justify-between bg-white rounded-xl px-2 py-1.5">
            <button onClick={() => step(-1)} className={STEP_ARROW} aria-label="‹">
                <ChevronLeft {...stepIcon} />
            </button>
            <p className="text-lg font-semibold text-gray-900">{label}</p>
            <button onClick={() => step(1)} className={STEP_ARROW} aria-label="›">
                <ChevronRight {...stepIcon} />
            </button>
        </div>
    );
}
