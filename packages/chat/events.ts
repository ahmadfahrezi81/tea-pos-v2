import { formatCalendarDay, formatCount, formatMoney } from "@tea-pos/format";
import type { Locale, MessageKey } from "@tea-pos/i18n";

type T = (key: MessageKey) => string;
type Data = Record<string, unknown> | undefined;

const num = (v: unknown) => (typeof v === "number" ? v : 0);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** `17–23 Nov`, or `28 Oct–3 Nov` across a month. */
export function period(start: string, end: string, locale: Locale): string {
    if (!start || !end) return "";
    const same = start.slice(0, 7) === end.slice(0, 7);
    return `${formatCalendarDay(start, locale, same ? "day" : "dayMonth")}–${formatCalendarDay(end, locale, "dayMonth")}`;
}

/**
 * The app's own message in the reader's language (Step 74; Go's twin is chatevent/text.go,
 * for the push). An event this build does not know shows its body, Go's English.
 */
export function eventText(
    m: { event?: string; data?: Data; body: string },
    t: T,
    locale: Locale,
): string {
    const d = m.data;
    const fill = (key: MessageKey, vars: Record<string, string>) =>
        Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), t(key));
    switch (m.event) {
        case "day_summary": {
            const cups = num(d?.cups);
            const parts = [
                fill("chat.evDay", { cups: formatCount(cups), sales: formatMoney(num(d?.sales)) }),
            ];
            if (typeof d?.prevCups === "number") {
                const diff = cups - d.prevCups;
                const n =
                    diff > 0 ? `+${formatCount(diff)}` : diff < 0 ? `−${formatCount(-diff)}` : "±0";
                parts.push(fill("chat.evDayPrev", { n }));
            }
            const avg = num(d?.avgCups);
            if (avg > 0) {
                const pct = Math.round(((cups - avg) / avg) * 100);
                parts.push(
                    pct > 0
                        ? fill("chat.evDayAbove", { n: formatCount(pct) })
                        : pct < 0
                          ? fill("chat.evDayBelow", { n: formatCount(-pct) })
                          : t("chat.evDayAvg"),
                );
            }
            return parts.join(" · ");
        }
        case "rain_started":
            return fill("chat.evRainStarted", { n: formatCount(num(d?.chance)) });
        case "rain_stopped":
            return fill("chat.evRainStopped", { n: formatCount(num(d?.chance)) });
        case "payout_paid": {
            const vars = {
                period: period(str(d?.start), str(d?.end), locale),
                total: formatMoney(num(d?.total)),
                payer: str(d?.payer),
                name: str(d?.name),
            };
            return fill(d?.vip ? "chat.evPayoutVip" : "chat.evPayoutMine", vars);
        }
        case "pay_total":
            return fill("chat.evPayTotal", {
                period: period(str(d?.start), str(d?.end), locale),
                total: formatMoney(num(d?.total)),
                n: formatCount(num(d?.people)),
            });
        case "release":
            return fill("chat.evRelease", { version: str(d?.version) });
    }
    return m.body || m.event || "";
}
