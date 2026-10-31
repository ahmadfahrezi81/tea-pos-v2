import { addDays, formatCalendarDay, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useSetSearch } from "@tea-pos/shell/searchParam";
import { DateRangeSheet, type DateRange } from "@tea-pos/ui/DateRangeSheet";
import { ICON } from "@tea-pos/ui/icon";
import { useSearch, type SearchSchemaInput } from "@tanstack/react-router";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";

import { isoWeek } from "../pay/dates";

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** A Store screen's `?from=&to=`: absent is today, so a plain address stays plain. */
export function rangeSearch(search: { from?: unknown; to?: unknown } & SearchSchemaInput): {
    from?: string;
    to?: string;
} {
    return isDay(search.from) && isDay(search.to) && search.from <= search.to
        ? { from: search.from, to: search.to }
        : {};
}

function presets(today: string) {
    const month = today.slice(0, 7);
    const lastDay = addDays(`${month}-01`, -1);
    return [
        { key: "today", from: today, to: today },
        { key: "yesterday", from: addDays(today, -1), to: addDays(today, -1) },
        { key: "last7", from: addDays(today, -6), to: today },
        { key: "last30", from: addDays(today, -29), to: today },
        { key: "thisMonth", from: `${month}-01`, to: today },
        { key: "lastMonth", from: `${lastDay.slice(0, 7)}-01`, to: lastDay },
    ] as const;
}

/** The one range every Store screen shows, from the address: its days, its words, and what it covers. */
export function useRange() {
    const t = useT();
    const locale = useLocale();
    const today = localDate();
    const search = useSearch({ strict: false }) as { from?: string; to?: string };
    const from = search.from ?? today;
    const to = search.to ?? today;
    const preset = presets(today).find((p) => p.from === from && p.to === to);
    const dates = (r: DateRange) =>
        r.from === r.to
            ? formatCalendarDay(r.from, locale, "short")
            : `${formatCalendarDay(r.from, locale, "short")} – ${formatCalendarDay(r.to, locale, "short")}`;
    // Short enough for one line: the weekday only for one day, the month once if it is the same.
    const short =
        from === to
            ? formatCalendarDay(from, locale, "short")
            : `${formatCalendarDay(from, locale, from.slice(0, 7) === to.slice(0, 7) ? "day" : "dayMonth")} – ${formatCalendarDay(to, locale)}`;
    // Past two weeks the number says nothing, and would not fit.
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    const week =
        days < 14
            ? `${t("store.week")} ${isoWeek(from)}${isoWeek(from) === isoWeek(to) ? "" : `-${isoWeek(to)}`}`
            : "";
    return {
        from,
        to,
        today,
        /** One day, so charts go by hour and times need no date. */
        single: from === to,
        isToday: from === today && to === today,
        label: preset ? t(`store.${preset.key}`) : short,
        /** Beside the label: the days, unless the label is them, and the week. */
        detail: [preset ? short : "", week].filter(Boolean).join(" · "),
        dates,
    };
}

/** The heading of a Store screen and its selector at once: what is picked; a tap opens the sheet. */
export function RangeBar() {
    const t = useT();
    const locale = useLocale();
    const { from, to, today, label, detail, dates } = useRange();
    const set = useSetSearch();
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="w-full flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 text-left active:bg-gray-50"
            >
                <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1">
                        <span className="text-lg font-bold tracking-tight text-gray-900 truncate">
                            {label}
                        </span>
                        <ChevronDown
                            size={ICON}
                            strokeWidth={2.5}
                            className="text-brand/90 shrink-0"
                        />
                    </span>
                    {detail && (
                        <span className="block text-sm font-medium text-gray-900 truncate">
                            {detail}
                        </span>
                    )}
                </span>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                    <CalendarDays size={ICON} className="text-brand" />
                </span>
            </button>
            <DateRangeSheet
                open={open}
                onClose={() => setOpen(false)}
                value={{ from, to }}
                onChange={(r) =>
                    set(r.from === today && r.to === today ? { from: "", to: "" } : { ...r })
                }
                today={today}
                locale={locale}
                presets={presets(today).map((p) => ({ ...p, label: t(`store.${p.key}`) }))}
                labels={{
                    title: t("store.dateRange"),
                    custom: t("store.custom"),
                    apply: t("store.apply"),
                    days: (n) =>
                        n === 1
                            ? t("store.oneDay")
                            : t("store.daysCount").replace("{n}", String(n)),
                }}
                formatRange={dates}
            />
        </>
    );
}
