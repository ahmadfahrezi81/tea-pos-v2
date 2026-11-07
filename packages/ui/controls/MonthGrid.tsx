import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { FIRST_MONTH, STEP_ARROW, stepIcon } from "./MonthStepper";

/** A year's months in a grid, ‹ › for other years; none after `today`'s month or before FIRST_MONTH. */
export function MonthGrid({
    value,
    today,
    locale,
    onPick,
}: {
    value: string | null;
    today: string;
    locale: string;
    onPick: (month: string) => void;
}) {
    const [year, setYear] = useState(Number((value ?? today).slice(0, 4)));
    const thisMonth = today.slice(0, 7);
    const name = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => setYear(year - 1)}
                    disabled={year <= Number(FIRST_MONTH.slice(0, 4))}
                    className={`${STEP_ARROW} disabled:opacity-30`}
                    aria-label="‹"
                >
                    <ChevronLeft {...stepIcon} />
                </button>
                <p className="font-bold text-gray-900">{year}</p>
                <button
                    onClick={() => setYear(year + 1)}
                    disabled={year >= Number(today.slice(0, 4))}
                    className={`${STEP_ARROW} disabled:opacity-30`}
                    aria-label="›"
                >
                    <ChevronRight {...stepIcon} />
                </button>
            </div>
            <div className="grid grid-cols-3 gap-2 pb-2">
                {Array.from({ length: 12 }, (_, i) => {
                    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
                    return (
                        <button
                            key={month}
                            disabled={month > thisMonth || month < FIRST_MONTH}
                            onClick={() => onPick(month)}
                            className={`h-12 rounded-xl text-base font-semibold disabled:opacity-30 active:opacity-70 ${
                                month === value
                                    ? "bg-brand text-white"
                                    : "bg-gray-100 text-gray-900"
                            }`}
                        >
                            {name.format(new Date(Date.UTC(year, i, 1)))}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
