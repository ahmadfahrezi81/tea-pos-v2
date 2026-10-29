import "@fontsource/bebas-neue/latin-400.css";

import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { Drawer, DrawerHandle } from "@tea-pos/ui/Drawer";
import { isNight, weatherOf } from "@tea-pos/ui/weather";
import { Cloud, X } from "lucide-react";

import { useWeather } from "./more";
import { Skeleton } from "@tea-pos/ui/Skeleton";

const nowInWib = () => {
    const d = new Date(Date.now() + 7 * 3_600_000);
    return { today: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
};
const addDays = (date: string, n: number) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
const hour12 = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? "PM" : "AM"}`;
const fetchedAt = (iso: string) => {
    const d = new Date(new Date(iso).getTime() + 7 * 3_600_000);
    const h = d.getUTCHours();
    return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getUTCMinutes()).padStart(2, "0")}${h >= 12 ? "pm" : "am"}`;
};

/** The old apps' weather sheet: the hour before now to six hours ahead, in the Bebas Neue title. */
export function WeatherSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    const t = useT();
    const { data, isPending } = useWeather(open);
    const { today, hour } = nowInWib();
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
            className="rounded-t-xl px-4 pt-5 pb-10 max-h-[90dvh] overflow-y-auto"
        >
            <DrawerHandle />
            <div
                className="flex items-center justify-between mb-3"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
                <div>
                    <p className="text-2xl font-light text-gray-900">
                        {data?.city || "Ciomas"}, {data?.region || "Bogor"}
                    </p>
                    <p className="text-lg text-gray-500 -mt-2">
                        {t("weather.asOf")}{" "}
                        {current?.fetchedAt ? fetchedAt(current.fetchedAt) : "—"}
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
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <Cloud className="size-10 mb-3" />
                    <p className="text-sm">{t("weather.noData")}</p>
                </div>
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
