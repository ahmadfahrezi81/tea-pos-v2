import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Drawer, DrawerHandle } from "@tea-pos/ui/Drawer";
import { isNight, weatherOf } from "@tea-pos/ui/weather";
import { X } from "lucide-react";

import { useWeather } from "./more";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { addDays, formatTime, localDate, localHour } from "@tea-pos/format";

const hour12 = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? "PM" : "AM"}`;

/** The old apps' weather sheet: the hour before now to six hours ahead. */
export function WeatherSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    const t = useT();
    const locale = useLocale();
    const { data, isPending } = useWeather(open);
    const today = localDate();
    const hour = localHour();
    const yesterday = addDays(today, -1);
    const tomorrow = addDays(today, 1);
    const spills = hour + 6 > 23;
    const shown = (data?.hours ?? []).filter((h) => {
        if (h.date === yesterday) return hour === 0 && h.hour === 23;
        if (spills)
            return (
                (h.date === today && h.hour >= hour - 1) ||
                (h.date === tomorrow && h.hour < (hour + 6) % 24)
            );
        return h.date === today && h.hour >= hour - 1 && h.hour <= hour + 6;
    });
    const current = data?.hours.find((h) => h.date === today && h.hour === hour);
    return (
        <Drawer
            open={open}
            onClose={onClose}
            className="px-4 pt-5 pb-5 max-h-[90dvh] overflow-y-auto"
        >
            <DrawerHandle />
            <div className="flex items-center justify-between mb-3">
                <div>
                    <p className="text-xl font-bold text-gray-900">
                        {data?.city || "Ciomas"}, {data?.region || "Bogor"}
                    </p>
                    <p className="text-sm text-gray-500">
                        {t("weather.asOf")}{" "}
                        {current?.fetchedAt ? formatTime(current.fetchedAt, locale) : "—"}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-full text-gray-900 hover:bg-gray-100 -mr-2"
                    aria-label={t("common.close")}
                >
                    <X size={26} />
                </button>
            </div>
            {isPending ? (
                <div className="space-y-3">
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-64 rounded-2xl" />
                </div>
            ) : shown.length === 0 ? (
                <EmptyState title={t("weather.noData")} />
            ) : (
                <div className="space-y-1">
                    {shown.map((h) => {
                        const now = h.date === today && h.hour === hour;
                        const past = h.date === yesterday || (h.date === today && h.hour < hour);
                        const w = weatherOf(h.code, isNight(h.hour));
                        return (
                            <div
                                key={`${h.date}-${h.hour}`}
                                className={`flex items-center justify-between px-4 py-3 pl-3 rounded-xl ${past ? "opacity-30 bg-gray-50" : now ? "bg-blue-50" : "bg-gray-50"}`}
                            >
                                <p
                                    className={`font-semibold w-16 ${now ? "text-base text-blue-500" : "text-sm text-gray-800"}`}
                                >
                                    {now ? t("weather.now") : hour12(h.hour)}
                                </p>
                                <div className="flex items-center gap-1.5 flex-1">
                                    <w.icon size={26} className="text-gray-900" />
                                    <p className="text-md text-gray-600 font-medium">
                                        {t(`weather.${w.key}` as MessageKey)}
                                    </p>
                                </div>
                                {h.rainChance > 0 && (
                                    <div className="flex items-center gap-1 w-14 justify-end">
                                        <p className="text-xs font-bold text-white bg-cyan-400 rounded-sm px-1 py-0.5">
                                            {h.rainChance}%
                                        </p>
                                    </div>
                                )}
                                <p className="text-sm font-semibold text-gray-900 w-11 text-right">
                                    {h.temperature}°C
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </Drawer>
    );
}
