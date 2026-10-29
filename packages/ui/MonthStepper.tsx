import { ChevronLeft, ChevronRight } from "lucide-react";

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
    const arrow = "p-1.5 rounded-full active:bg-gray-100 text-gray-500";
    return (
        <div className="flex items-center justify-between bg-white rounded-xl px-2 py-1.5">
            <button onClick={() => step(-1)} className={arrow} aria-label="‹">
                <ChevronLeft size={24} />
            </button>
            <p className="text-lg font-semibold text-gray-900">{label}</p>
            <button onClick={() => step(1)} className={arrow} aria-label="›">
                <ChevronRight size={24} />
            </button>
        </div>
    );
}
