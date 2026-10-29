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

/** `3 days left`, `1 day left`. */
export const daysLeftText = (
    t: (k: "pay.daysLeftLong" | "pay.dayLeftLong") => string,
    n: number,
) => (n === 1 ? t("pay.dayLeftLong") : t("pay.daysLeftLong").replace("{n}", String(n)));
