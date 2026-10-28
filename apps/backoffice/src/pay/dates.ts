/** Days left in the period, counted in the store's calendar: `last day` or `3d left`. */
export function daysLeft(end: string, today: string): number {
    return Math.round((Date.parse(end) - Date.parse(today)) / 86_400_000);
}

/** ISO week number of a `2026-10-12` date. */
export function isoWeek(date: string): number {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

/** `Week 41` or `Week 41 · Week 43`. */
export function weeks(start: string, end: string, word: string): string {
    const a = isoWeek(start);
    const b = isoWeek(end);
    return a === b ? `${word} ${a}` : `${word} ${a} · ${word} ${b}`;
}

export const dayMonth = (date: string, locale: string) =>
    new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));

export const shortDay = (date: string, locale: string) =>
    new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));
