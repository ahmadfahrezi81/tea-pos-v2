import { addDays, isoWeek, localDate } from "@tea-pos/format";
import { useT } from "@tea-pos/i18n/react";
import { MoreScreen } from "@tea-pos/shell/MoreScreen";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { useSlug } from "@tea-pos/shell/tenant";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Banknote, ReceiptText, Store } from "lucide-react";
import { useEffect, useRef } from "react";

import { useMyWorkDays } from "./mine";

const PAST_WEEKS = 3;

/** The More tab, as v1: Work Days and Personal above the shared rows. */
export function More() {
    const t = useT();
    const slug = useSlug();
    return (
        <MoreScreen
            before={
                <>
                    <section className="space-y-2">
                        <SectionLabel>{t("more.workDays")}</SectionLabel>
                        <WorkDays />
                    </section>
                    <SettingsGroup title={t("more.personal")}>
                        <SettingsRow
                            to={`/${slug}/more/earnings`}
                            icon={<Banknote {...rowIcon} />}
                            label={t("more.myPay")}
                        />
                        <SettingsRow
                            to={`/${slug}/more/claims`}
                            icon={<ReceiptText {...rowIcon} />}
                            label={t("more.myClaims")}
                        />
                        <SettingsRow
                            to={`/${slug}/more/stores`}
                            icon={<Store {...rowIcon} />}
                            label={t("more.myStores")}
                        />
                    </SettingsGroup>
                </>
            }
        />
    );
}

/** The last four weeks, Monday first, the days worked in colour, scrolled to this week. */
function WorkDays() {
    const t = useT();
    const today = localDate();
    const day = new Date(`${today}T00:00:00Z`).getUTCDay();
    const monday = addDays(today, -((day + 6) % 7));
    const first = addDays(monday, -7 * PAST_WEEKS);
    const { data } = useMyWorkDays(first, today);
    const scroller = useRef<HTMLDivElement>(null);
    const loaded = !!data;
    useEffect(() => {
        if (loaded) scroller.current?.scrollTo({ left: scroller.current.scrollWidth });
    }, [loaded]);
    if (!data)
        return (
            <div className="bg-white rounded-2xl px-3 py-3">
                <Skeleton className="h-16 rounded-lg" />
            </div>
        );
    const worked = new Set(data.days);
    return (
        <div className="bg-white rounded-2xl px-3 py-3">
            <div
                ref={scroller}
                className="flex gap-5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
            >
                {Array.from({ length: PAST_WEEKS + 1 }, (_, w) => {
                    const start = addDays(first, w * 7);
                    return (
                        <div key={start} className="flex-none flex flex-col gap-1.5">
                            <p className="flex items-center gap-1 text-sm font-semibold text-gray-500">
                                {t("earnings.week")} {isoWeek(start)}
                                {w === PAST_WEEKS && (
                                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                )}
                            </p>
                            <div className="flex gap-1.5">
                                {Array.from({ length: 7 }, (_, d) => {
                                    const iso = addDays(start, d);
                                    return (
                                        <div
                                            key={iso}
                                            className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium ${
                                                worked.has(iso)
                                                    ? "bg-brand text-white font-semibold"
                                                    : iso > today
                                                      ? "border border-dashed border-gray-300 text-gray-400"
                                                      : "bg-gray-100 text-gray-500"
                                            }`}
                                        >
                                            {+iso.slice(8)}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
