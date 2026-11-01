import { formatCalendarDay, formatTime, isoWeek, localDate } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { EVENT } from "@tea-pos/shell/dayEvents";
import { useSlug, useTenant } from "@tea-pos/shell/tenant";
import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useDayMilestones, useGate } from "./home";

const BUFFER = 60;
const BAR = 900;
const WIB = 7 * 60;

const minutesOf = (hhmm: string, fallback: number) => {
    const [h, m] = hhmm.split(":").map(Number);
    return !hhmm || h === undefined || Number.isNaN(h) ? fallback : h * 60 + (m ?? 0);
};
/** The minute of the day in the stores' time zone. */
const localMinutes = (at: number) => Math.floor(at / 60_000 + WIB) % (24 * 60);

/** The top of POS and Manage, as v1: the greeting, the switch, and the day so far along its hours. */
export function HomeHeader() {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const store = useTenant()?.store;
    const path = useLocation({ select: (l) => l.pathname });
    const onManage = path.endsWith("/manage");
    const today = localDate();
    const { data: gate } = useGate();
    const { data } = useDayMilestones(gate?.dayId);
    const scroller = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState<string | null>(null);
    const [clock, setClock] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setClock(Date.now()), 60_000);
        return () => clearInterval(timer);
    }, []);

    const open = minutesOf(store?.openTime ?? "", 600) - BUFFER;
    const close = minutesOf(store?.closeTime ?? "", 1320) + BUFFER;
    const hours = Math.max(1, Math.round((close - open) / 60));
    const now = localMinutes(clock);
    const hour = Math.floor(now / 60);
    const place = (minutes: number) => Math.min(1, Math.max(0, (minutes - open) / (hours * 60)));
    const progress = place(now);
    const events = (data?.events ?? []).filter((e) => EVENT[e.type]);

    useEffect(() => {
        const el = scroller.current;
        if (el) el.scrollTo({ left: progress * BAR - el.offsetWidth / 2 });
    }, [progress]);

    const pill = (on: boolean) =>
        `px-3.5 py-0.5 rounded-lg text-lg font-semibold transition-all duration-200 ${on ? "bg-white text-slate-950" : "text-slate-600"}`;
    const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    return (
        <div>
            <div className="pb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xl font-bold text-gray-900 tracking-tight">
                        {t(`home.greeting.${greeting}`)}
                    </p>
                    <p className="text-base text-gray-600 truncate">
                        {t("earnings.week")} {isoWeek(today)} ·{" "}
                        {formatCalendarDay(today, locale, "short")}
                    </p>
                </div>
                <div className="flex items-center bg-slate-200 rounded-xl p-1 shrink-0">
                    <Link
                        to="/$tenant/pos"
                        params={{ tenant: slug }}
                        replace
                        className={pill(!onManage)}
                    >
                        {t("nav.pos")}
                    </Link>
                    <Link
                        to="/$tenant/manage"
                        params={{ tenant: slug }}
                        replace
                        className={pill(onManage)}
                    >
                        {t("nav.manage")}
                    </Link>
                </div>
            </div>
            <div
                ref={scroller}
                onScroll={() => active && setActive(null)}
                className="overflow-x-auto [&::-webkit-scrollbar]:hidden"
            >
                <div style={{ width: BAR }} className="relative px-4 pt-9 pb-8">
                    <div className="relative flex items-center gap-1">
                        {Array.from({ length: hours }, (_, i) => {
                            const fill = Math.min(1, Math.max(0, progress * hours - i));
                            return (
                                <div
                                    key={i}
                                    className={`flex-1 h-4 rounded-full overflow-hidden ${i === 0 || i === hours - 1 ? "bg-gray-200/50" : "bg-gray-200"}`}
                                >
                                    {fill > 0 && (
                                        <div
                                            className="h-full bg-blue-600 rounded-full"
                                            style={{ width: `${fill * 100}%` }}
                                        />
                                    )}
                                </div>
                            );
                        })}
                        {events.map((e) => {
                            const look = EVENT[e.type];
                            if (!look) return null;
                            const at = place(localMinutes(Date.parse(e.at)));
                            return (
                                <div
                                    key={e.id}
                                    className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                                    style={{ left: `${at * 100}%` }}
                                >
                                    {active === e.id && (
                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-gray-800 text-white text-[10px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap">
                                            {t(`manage.glance.${e.type}` as MessageKey)} ·{" "}
                                            {formatTime(e.at, locale)}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => setActive(active === e.id ? null : e.id)}
                                        className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 border-white shadow-sm ${look.color}`}
                                    >
                                        <look.icon
                                            size={24}
                                            strokeWidth={2}
                                            className="text-white"
                                        />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
