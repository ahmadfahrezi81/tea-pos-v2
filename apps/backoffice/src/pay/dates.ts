/** Days left in the period, counted in the store's calendar: `last day` or `3d left`. */
export function daysLeft(end: string, today: string): number {
    return Math.round((Date.parse(end) - Date.parse(today)) / 86_400_000);
}

export { isoWeek, weeks } from "@tea-pos/format";

/** `3 days left`, `1 day left`. */
export const daysLeftText = (
    t: (k: "pay.daysLeftLong" | "pay.dayLeftLong") => string,
    n: number,
) => (n === 1 ? t("pay.dayLeftLong") : t("pay.daysLeftLong").replace("{n}", String(n)));
