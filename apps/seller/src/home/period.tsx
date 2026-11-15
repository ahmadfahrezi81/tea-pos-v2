import { addDays, formatCalendarDay, isoWeek, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useSearchParam } from "@tea-pos/shell/searchParam";
import { useStoreChoice } from "@tea-pos/shell/StoreLabel";
import { useTenant } from "@tea-pos/shell/tenant";
import { DateRangeSheet, monthRange, type DateRange } from "@tea-pos/ui/DateRangeSheet";
import { PickerButton } from "@tea-pos/ui/PickerButton";
import { useState } from "react";

/** The month `back` months before `today`'s: `2026-09`. */
const monthBack = (today: string, back: number) =>
    new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - back, 1))
        .toISOString()
        .slice(0, 7);

/** The months a seller can pick, newest first: this one and the two before. */
const sellerMonths = (today: string) => [0, 1, 2].map((i) => monthBack(today, i));

/** How far back a seller reads: the 1st of the month two months ago (Go refuses earlier, too_far_back). */
export const earliestDay = (today: string) => `${monthBack(today, 2)}-01`;

/** Orders' day, from `?date=`: absent, wrong or out of reach is today. */
export function useSellerDay(): [string, (date: string) => void] {
    const today = localDate();
    const [raw, set] = useSearchParam("date");
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw >= earliestDay(today) && raw <= today;
    return [ok ? raw : today, (d) => set(d === today ? "" : d)];
}

/** Analytics' month, from `?month=`, as its days up to today. */
export function useSellerMonth(): [DateRange & { month: string }, (month: string) => void] {
    const today = localDate();
    const [raw, set] = useSearchParam("month");
    const months = sellerMonths(today);
    const thisMonth = today.slice(0, 7);
    const month = months.includes(raw) ? raw : thisMonth;
    return [{ month, ...monthRange(month, today) }, (m) => set(m === thisMonth ? "" : m)];
}

const sheetLabels = (t: ReturnType<typeof useT>, title: string) => ({
    title,
    custom: t("store.pickDay"),
    month: t("store.pickMonth"),
    apply: t("store.apply"),
    days: (n: number) =>
        n === 1 ? t("store.oneDay") : t("store.daysCount").replace("{n}", String(n)),
});

/** Orders' heading and day picker: Today, Yesterday, or a day from the calendar. */
export function DayBar() {
    const t = useT();
    const locale = useLocale();
    const today = localDate();
    const [date, setDate] = useSellerDay();
    const [open, setOpen] = useState(false);
    const presets = [
        { key: "today", from: today, to: today, label: t("store.today") },
        {
            key: "yesterday",
            from: addDays(today, -1),
            to: addDays(today, -1),
            label: t("store.yesterday"),
        },
    ];
    const preset = presets.find((p) => p.from === date);
    const short = formatCalendarDay(date, locale, "short");
    const week = `${t("store.week")} ${isoWeek(date)}`;
    const store = useTenant()?.store?.name;
    const choice = useStoreChoice(t("shell.date"));
    return (
        <>
            <PickerButton
                heading={store}
                withStore={(choice?.options.length ?? 0) > 1}
                label={preset ? preset.label : short}
                detail={preset ? `${short} · ${week}` : week}
                onClick={() => setOpen(true)}
            />
            <DateRangeSheet
                open={open}
                onClose={() => setOpen(false)}
                value={{ from: date, to: date }}
                onChange={(r) => setDate(r.from)}
                today={today}
                firstMonth={earliestDay(today).slice(0, 7)}
                locale={locale}
                presets={presets}
                labels={sheetLabels(t, t("store.pickDay"))}
                formatRange={(r) => formatCalendarDay(r.from, locale, "short")}
                single
                only="custom"
                store={choice}
            />
        </>
    );
}

/** Analytics' heading and month picker: this month or one of the two before. */
export function MonthBar() {
    const t = useT();
    const locale = useLocale();
    const today = localDate();
    const [range, setMonth] = useSellerMonth();
    const [open, setOpen] = useState(false);
    const name = (m: string) =>
        new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
            new Date(`${m}-01T00:00:00Z`),
        );
    const presets = sellerMonths(today).map((m, i) => ({
        key: m,
        ...monthRange(m, today),
        label: i === 0 ? t("store.thisMonth") : name(m),
    }));
    // How far into the month: this one still running ("Day 15 of 30"), a past one whole ("31 days").
    const days = (r: DateRange) => {
        const span = `${formatCalendarDay(r.from, locale, "day")} – ${formatCalendarDay(r.to, locale)}`;
        const total = new Date(
            Date.UTC(Number(r.from.slice(0, 4)), Number(r.from.slice(5, 7)), 0),
        ).getUTCDate();
        const day = Number(r.to.slice(8, 10));
        const how =
            day < total
                ? t("store.dayOf").replace("{n}", String(day)).replace("{m}", String(total))
                : t("store.daysCount").replace("{n}", String(total));
        return `${span} · ${how}`;
    };
    const store = useTenant()?.store?.name;
    const choice = useStoreChoice(t("shell.month"));
    return (
        <>
            <PickerButton
                label={presets.find((p) => p.key === range.month)?.label ?? name(range.month)}
                heading={store}
                withStore={(choice?.options.length ?? 0) > 1}
                detail={days(range)}
                onClick={() => setOpen(true)}
            />
            <DateRangeSheet
                open={open}
                onClose={() => setOpen(false)}
                value={range}
                onChange={(r) => setMonth(r.from.slice(0, 7))}
                today={today}
                firstMonth={earliestDay(today).slice(0, 7)}
                locale={locale}
                presets={presets}
                labels={sheetLabels(t, t("store.pickMonth"))}
                formatRange={days}
                only="month"
                store={choice}
            />
        </>
    );
}
