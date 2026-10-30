import { addDays, formatCalendarDay, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useSetSearch } from "@tea-pos/shell/searchParam";
import { DateRangeSheet, type DateRange } from "@tea-pos/ui/DateRangeSheet";
import { ICON } from "@tea-pos/ui/icon";
import { useSearch, type SearchSchemaInput } from "@tanstack/react-router";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";

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
    return {
        from,
        to,
        today,
        /** One day, so charts go by hour and times need no date. */
        single: from === to,
        isToday: from === today && to === today,
        label: preset ? t(`store.${preset.key}`) : dates({ from, to }),
        dates,
    };
}

/** The selector at the top of a Store screen: what is picked; a tap opens the sheet. */
export function RangeBar() {
    const t = useT();
    const locale = useLocale();
    const { from, to, today, label, dates } = useRange();
    const set = useSetSearch();
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="w-full flex items-center gap-2 rounded-2xl bg-white px-4 py-3.5 active:bg-gray-50"
            >
                <CalendarDays size={ICON} className="text-gray-900 shrink-0" />
                <span className="font-bold text-gray-900 truncate">{label}</span>
                <ChevronDown size={ICON} className="text-brand/90 shrink-0" />
                <span className="ml-auto text-sm font-medium text-gray-900 truncate">
                    {dates({ from, to })}
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
                    days: (n) => t("store.daysCount").replace("{n}", String(n)),
                }}
                formatRange={dates}
            />
        </>
    );
}
