import { addDays, formatCalendarDay, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useSetSearch } from "@tea-pos/shell/searchParam";
import { useFirstMonth, useSlug, useTenant } from "@tea-pos/shell/tenant";
import {
    DateRangeSheet,
    monthRange,
    type DateRange,
    type StoreChoice,
} from "@tea-pos/ui/DateRangeSheet";
import { PickerButton } from "@tea-pos/ui/PickerButton";
import {
    useLocation,
    useNavigate,
    useSearch,
    type SearchSchemaInput,
} from "@tanstack/react-router";
import { useState } from "react";

import { isoWeek } from "../pay/dates";
import { ALL, useStoreId } from "./sales";

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
    return [
        { key: "today", from: today, to: today },
        { key: "yesterday", from: addDays(today, -1), to: addDays(today, -1) },
        { key: "last7", from: addDays(today, -6), to: today },
        { key: "last30", from: addDays(today, -29), to: today },
        { key: "thisMonth", from: `${month}-01`, to: today },
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
    // A whole month picked: its name ("October 2026"), as people say it.
    const range = monthRange(from.slice(0, 7), today);
    const month =
        !preset && range.from === from && range.to === to
            ? new Intl.DateTimeFormat(locale, {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
              }).format(new Date(`${from}T00:00:00Z`))
            : "";
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
        label: preset ? t(`store.${preset.key}`) : month || short,
        /** Beside the label: the days, unless the label is them, and the week. */
        detail: [preset || month ? short : "", week].filter(Boolean).join(" · "),
        dates,
    };
}

/** The heading of a Store screen and its selector at once: what is picked; a tap opens the sheet. */
export function RangeBar() {
    const firstMonth = useFirstMonth();
    const t = useT();
    const locale = useLocale();
    const { from, to, today, label, detail, dates } = useRange();
    const set = useSetSearch();
    const [open, setOpen] = useState(false);
    const store = useStoreChoice();
    return (
        <>
            <PickerButton
                heading={store.options.find((o) => o.id === store.picked)?.name}
                label={label}
                detail={detail}
                onClick={() => setOpen(true)}
            />
            <DateRangeSheet
                store={store}
                open={open}
                onClose={() => setOpen(false)}
                value={{ from, to }}
                onChange={(r) =>
                    set(r.from === today && r.to === today ? { from: "", to: "" } : { ...r })
                }
                today={today}
                firstMonth={firstMonth}
                locale={locale}
                presets={presets(today).map((p) => ({ ...p, label: t(`store.${p.key}`) }))}
                labels={{
                    title: t("store.dateRange"),
                    custom: t("store.custom"),
                    month: t("store.pickMonth"),
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

/**
 * A Store screen's store, for its picker card and the sheet's Store and Date menu: All stores, then
 * each store the tenant shows. The store is in the address, so a pick goes to the same screen of the
 * other store, keeping the dates: the Store home to a store's page, a store's page back to All stores
 * as the Store home.
 */
function useStoreChoice(): StoreChoice {
    const t = useT();
    const slug = useSlug();
    const storeId = useStoreId();
    const stores = useTenant()?.stores ?? [];
    const path = useLocation({ select: (l) => l.pathname });
    const navigate = useNavigate();
    const rest = path.match(/\/store\/[^/]+(\/.*)?$/)?.[1] ?? "";
    const pick = (id: string | null) => {
        const to = rest
            ? `/${slug}/store/${id ?? ALL}${rest}`
            : id
              ? `/${slug}/store/${id}`
              : `/${slug}/store`;
        void navigate({ to, search: ((prev: object) => prev) as never, replace: true });
    };
    return {
        menuTitle: t("shell.storeAndDate"),
        label: t("shell.store"),
        dateLabel: t("shell.date"),
        options: [
            { id: null, name: t("shell.allStores") },
            ...stores.map((s) => ({ id: s.id, name: s.name })),
        ],
        picked: storeId === ALL ? null : storeId,
        onPick: pick,
    };
}
