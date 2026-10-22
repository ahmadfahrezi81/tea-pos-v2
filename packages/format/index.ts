// One function per display style, so a date looks the same on every screen.
// Intl only: no date library on the phone.

import type { Locale } from "@tea-pos/i18n";

export type DateInput = Date | string | number;

// Every store is in WIB; times show the store's clock, not the phone's.
export const TIME_ZONE = "Asia/Jakarta";

const tags: Record<Locale, string> = { en: "en-GB", id: "id-ID" };

// Building an Intl formatter is slow on a cheap phone; each one is made once.
const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat | Intl.RelativeTimeFormat>();

function dateFormat(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const key = `d:${locale}:${JSON.stringify(options)}`;
    let format = cache.get(key) as Intl.DateTimeFormat | undefined;
    if (!format) {
        format = new Intl.DateTimeFormat(tags[locale], { timeZone: TIME_ZONE, ...options });
        cache.set(key, format);
    }
    return format;
}

const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));

/** `2026-10-22`: the store's calendar day, for comparing and for API parameters. */
export function localDate(value: DateInput = new Date()): string {
    const parts = dateFormat("en", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(toDate(value));
    const part = (type: string) => parts.find((p) => p.type === type)?.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
}

/** `22 Oct`, or `22 Oct 2025` outside the current year. */
export function formatDate(value: DateInput, locale: Locale, now: DateInput = new Date()): string {
    const date = toDate(value);
    const sameYear = localDate(date).slice(0, 4) === localDate(now).slice(0, 4);
    return dateFormat(locale, {
        day: "numeric",
        month: "short",
        year: sameYear ? undefined : "numeric",
    }).format(date);
}

/** `14:05`. */
export function formatTime(value: DateInput, locale: Locale): string {
    return dateFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
        toDate(value),
    );
}

/** `22 Oct, 14:05`. */
export function formatDateTime(
    value: DateInput,
    locale: Locale,
    now: DateInput = new Date(),
): string {
    return `${formatDate(value, locale, now)}, ${formatTime(value, locale)}`;
}

/** `October 2026`. Takes a `2026-10` month or any date in it. */
export function formatMonth(value: DateInput, locale: Locale): string {
    const date = typeof value === "string" && value.length === 7 ? `${value}-15` : value;
    return dateFormat(locale, { month: "long", year: "numeric" }).format(toDate(date));
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** `5 min ago` and `2 hr ago` today, then `yesterday`, `3 days ago`; after a week, the date. */
export function formatRelative(
    value: DateInput,
    locale: Locale,
    now: DateInput = new Date(),
): string {
    const key = `r:${locale}`;
    let format = cache.get(key) as Intl.RelativeTimeFormat | undefined;
    if (!format) {
        format = new Intl.RelativeTimeFormat(tags[locale], { numeric: "auto", style: "short" });
        cache.set(key, format);
    }
    // Calendar days in the store's time zone, so "yesterday" means yesterday at the store.
    const days = Math.round((Date.parse(localDate(now)) - Date.parse(localDate(value))) / DAY);
    if (days >= 7) return formatDate(value, locale, now);
    if (days > 0) return format.format(-days, "day");
    const elapsed = toDate(now).getTime() - toDate(value).getTime();
    if (elapsed < MINUTE) return format.format(0, "second");
    if (elapsed < HOUR) return format.format(-Math.floor(elapsed / MINUTE), "minute");
    return format.format(-Math.floor(elapsed / HOUR), "hour");
}

const money = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
});

/** `Rp 15.000`. Rupiah in Indonesian style whatever the language. */
export function formatMoney(amount: number): string {
    return money.format(amount).replace(/^Rp\s*/, "Rp ");
}
