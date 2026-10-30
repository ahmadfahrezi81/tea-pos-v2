import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { STEP_ARROW, stepIcon } from "./MonthStepper";
import { ICON } from "../lib/icon";
import { Sheet } from "../layout/Sheet";

export type DateRange = { from: string; to: string };
export type RangePreset = DateRange & { key: string; label: string };

const MAX_DAYS = 400;
const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const span = (from: string, to: string) =>
    (utc(to).getTime() - utc(from).getTime()) / 86_400_000 + 1;

/**
 * Picks a range of whole days: a tap on a preset applies it and closes; Custom opens a calendar
 * (tap the first day, then the last, then Apply). Days are `2026-10-22`; none after `today`.
 */
export function DateRangeSheet({
    open,
    onClose,
    value,
    onChange,
    today,
    presets,
    locale,
    labels,
    formatRange,
}: {
    open: boolean;
    onClose: () => void;
    value: DateRange;
    onChange: (range: DateRange) => void;
    today: string;
    presets: RangePreset[];
    locale: string;
    labels: { title: string; custom: string; apply: string; days: (n: number) => string };
    formatRange: (range: DateRange) => string;
}) {
    const [custom, setCustom] = useState(false);
    const close = () => {
        setCustom(false);
        onClose();
    };
    const picked = presets.find((p) => p.from === value.from && p.to === value.to)?.key;
    return (
        <Sheet
            open={open}
            onClose={close}
            title={custom ? labels.custom : labels.title}
            onBack={custom ? () => setCustom(false) : undefined}
        >
            {custom ? (
                <Calendar
                    value={value}
                    today={today}
                    locale={locale}
                    labels={labels}
                    formatRange={formatRange}
                    onApply={(r) => {
                        onChange(r);
                        close();
                    }}
                />
            ) : (
                <div className="divide-y divide-gray-100">
                    {presets.map((p) => (
                        <button
                            key={p.key}
                            onClick={() => {
                                onChange({ from: p.from, to: p.to });
                                close();
                            }}
                            className="w-full flex items-center justify-between py-4 text-left text-[17px] font-medium text-gray-900 active:opacity-70"
                        >
                            {p.label}
                            {picked === p.key && <Check size={ICON} className="text-brand" />}
                        </button>
                    ))}
                    <button
                        onClick={() => setCustom(true)}
                        className="w-full flex items-center justify-between py-4 text-left text-[17px] font-medium text-gray-900 active:opacity-70"
                    >
                        {labels.custom}
                        {picked ? (
                            <ChevronRight size={ICON} className="text-brand/90" />
                        ) : (
                            <Check size={ICON} className="text-brand" />
                        )}
                    </button>
                </div>
            )}
        </Sheet>
    );
}

function Calendar({
    value,
    today,
    locale,
    labels,
    formatRange,
    onApply,
}: {
    value: DateRange;
    today: string;
    locale: string;
    labels: { apply: string; days: (n: number) => string };
    formatRange: (range: DateRange) => string;
    onApply: (range: DateRange) => void;
}) {
    const [from, setFrom] = useState(value.from);
    const [to, setTo] = useState<string | null>(value.to);
    const [month, setMonth] = useState(value.to.slice(0, 7));

    const first = utc(`${month}-01`);
    const count = new Date(
        Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
    // Monday first, as the pay weeks.
    const blanks = (first.getUTCDay() + 6) % 7;
    const step = (n: number) =>
        setMonth(
            iso(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + n, 1))).slice(0, 7),
        );
    const tap = (day: string) => {
        if (to !== null || day < from) {
            setFrom(day);
            setTo(null);
        } else setTo(day);
    };
    const end = to ?? from;
    const days = span(from, end);
    const fmt = (o: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(locale, { ...o, timeZone: "UTC" });
    // 2 Nov 2026 is a Monday.
    const weekdays = Array.from({ length: 7 }, (_, i) =>
        fmt({ weekday: "narrow" }).format(new Date(Date.UTC(2026, 10, 2 + i))),
    );

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <button onClick={() => step(-1)} className={STEP_ARROW} aria-label="‹">
                    <ChevronLeft {...stepIcon} />
                </button>
                <p className="font-bold text-gray-900">
                    {fmt({ month: "long", year: "numeric" }).format(first)}
                </p>
                <button
                    onClick={() => step(1)}
                    disabled={month >= today.slice(0, 7)}
                    className={`${STEP_ARROW} disabled:opacity-30`}
                    aria-label="›"
                >
                    <ChevronRight {...stepIcon} />
                </button>
            </div>
            <div className="grid grid-cols-7 text-center">
                {weekdays.map((d, i) => (
                    <span key={i} className="py-1 text-sm font-semibold text-gray-900">
                        {d}
                    </span>
                ))}
                {Array.from({ length: blanks }, (_, i) => (
                    <span key={`blank-${i}`} />
                ))}
                {Array.from({ length: count }, (_, i) => {
                    const day = `${month}-${String(i + 1).padStart(2, "0")}`;
                    const edge = day === from || day === end;
                    const inside = day > from && day < end;
                    return (
                        <button
                            key={day}
                            disabled={day > today}
                            onClick={() => tap(day)}
                            className={`h-11 text-base font-medium disabled:opacity-30 ${
                                edge
                                    ? "rounded-lg bg-brand text-white"
                                    : inside
                                      ? "bg-brand/10 text-gray-900"
                                      : "text-gray-900"
                            }`}
                        >
                            {i + 1}
                        </button>
                    );
                })}
            </div>
            <p className="text-center text-sm font-medium text-gray-900">
                {formatRange({ from, to: end })} · {labels.days(days)}
            </p>
            <button
                disabled={days > MAX_DAYS}
                onClick={() => onApply({ from, to: end })}
                className="w-full rounded-xl bg-brand py-3.5 font-semibold text-white disabled:opacity-40"
            >
                {labels.apply}
            </button>
        </div>
    );
}
