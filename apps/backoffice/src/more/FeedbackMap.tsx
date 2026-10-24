import "leaflet/dist/leaflet.css";

import type { components } from "@tea-pos/api-client";
import { formatRelative } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Sheet } from "@tea-pos/ui/Sheet";
import L from "leaflet";
import { Check, MessageSquare, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useFeedbacks } from "./more";

type Feedback = components["schemas"]["Feedback"];
// One empty list for every render, so the markers effect does not re-run without data.
const NONE: Feedback[] = [];
type Range = "all" | "today" | "week" | "month";
const RANGES: Range[] = ["all", "today", "week", "month"];
const RANGE_LABEL = {
    all: "map.allTime",
    today: "map.today",
    week: "map.last7Days",
    month: "map.last30Days",
} as const;
// The old app's centre: Bogor.
const BOGOR: L.LatLngTuple = [-6.5971, 106.8002];

const wibDay = (iso: string) =>
    new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
const placeKey = (f: Feedback) => `${f.latitude.toFixed(2)},${f.longitude.toFixed(2)}`;

function since(range: Range): number | null {
    if (range === "all") return null;
    const start = Date.parse(`${wibDay(new Date().toISOString())}T00:00:00+07:00`);
    return start - (range === "week" ? 6 : range === "month" ? 29 : 0) * 86_400_000;
}

/**
 * The old backoffice's Location Feedback: a map of where customers asked for a store (a count
 * per place), then the list by day, searchable and filtered by date and by who wrote it down.
 * Leaflet with OpenStreetMap tiles: no key, and it loads only on this screen.
 */
export function FeedbackMap() {
    const t = useT();
    const locale = useLocale();
    const { data, isPending } = useFeedbacks();
    const box = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const [query, setQuery] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [range, setRange] = useState<Range>("all");
    const [people, setPeople] = useState<string[]>([]);
    const feedbacks = data?.feedbacks ?? NONE;

    const places = new Map<string, Feedback[]>();
    for (const f of feedbacks) places.set(placeKey(f), [...(places.get(placeKey(f)) ?? []), f]);
    const names = [...new Set(feedbacks.map((f) => f.userName || t("common.unknown")))].sort();

    useEffect(() => {
        if (!box.current || map.current) return;
        map.current = L.map(box.current, { attributionControl: true, zoomControl: false }).setView(
            BOGOR,
            11,
        );
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "© OpenStreetMap",
        }).addTo(map.current);
        return () => {
            map.current?.remove();
            map.current = null;
        };
    }, []);

    useEffect(() => {
        const m = map.current;
        if (!m || feedbacks.length === 0) return;
        const layer = L.layerGroup().addTo(m);
        const groups = new Map<string, Feedback[]>();
        for (const f of feedbacks) groups.set(placeKey(f), [...(groups.get(placeKey(f)) ?? []), f]);
        for (const group of groups.values()) {
            const f = group[0]!;
            const icon = L.divIcon({
                className: "",
                html: `<div style="min-width:28px;height:28px;padding:0 6px;background:var(--color-brand);border:2.5px solid white;border-radius:14px;box-shadow:0 2px 6px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;font:700 11px system-ui,sans-serif;color:white">${group.length}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
            });
            L.marker([f.latitude, f.longitude], { icon }).addTo(layer);
        }
        if (feedbacks.length > 1) {
            m.fitBounds(
                L.latLngBounds(feedbacks.map((f) => [f.latitude, f.longitude] as L.LatLngTuple)),
                { padding: [40, 40], maxZoom: 14 },
            );
        } else {
            m.setView([feedbacks[0]!.latitude, feedbacks[0]!.longitude], 13);
        }
        return () => void layer.remove();
    }, [feedbacks]);

    const cutoff = since(range);
    const q = query.trim().toLowerCase();
    const shown = feedbacks.filter((f) => {
        if (cutoff !== null && Date.parse(f.at) < cutoff) return false;
        if (people.length > 0 && !people.includes(f.userName || t("common.unknown"))) return false;
        return (
            !q ||
            [f.locationDisplay, f.locationName, f.userName, f.notes]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(q)
        );
    });
    const days = new Map<string, Feedback[]>();
    for (const f of shown) days.set(wibDay(f.at), [...(days.get(wibDay(f.at)) ?? []), f]);
    const today = wibDay(new Date().toISOString());
    const dayLabel = (d: string) =>
        d === today
            ? t("map.today")
            : Date.parse(today) - Date.parse(d) === 86_400_000
              ? t("map.yesterday")
              : new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                }).format(new Date(`${d}T00:00:00Z`));
    const active = (range !== "all" ? 1 : 0) + people.length;

    return (
        <div className="flex flex-col gap-3">
            <div className="h-[220px] w-full rounded-2xl overflow-hidden bg-gray-100 isolate">
                <div ref={box} className="size-full" />
            </div>
            {!isPending && feedbacks.length > 0 && (
                <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-white rounded-xl px-3 py-2.5">
                        <Search size={16} className="text-gray-400 shrink-0" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t("map.search")}
                            className="flex-1 text-base text-gray-800 placeholder:text-gray-400 bg-transparent outline-none"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery("")}
                                className="text-gray-400"
                                aria-label={t("common.close")}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setFilterOpen(true)}
                        aria-label={t("map.filter")}
                        className="relative flex items-center justify-center w-11 bg-white rounded-xl active:bg-gray-50"
                    >
                        <SlidersHorizontal
                            size={18}
                            className={active > 0 ? "text-brand" : "text-gray-500"}
                        />
                        {active > 0 && (
                            <span className="absolute -top-1 -right-1 size-4 bg-brand text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {active}
                            </span>
                        )}
                    </button>
                </div>
            )}
            {isPending ? (
                [1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />
                ))
            ) : feedbacks.length === 0 || shown.length === 0 ? (
                <div className="bg-white rounded-2xl flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                    {feedbacks.length === 0 ? (
                        <MessageSquare size={28} className="opacity-50" />
                    ) : (
                        <Search size={28} className="opacity-50" />
                    )}
                    <p className="text-sm">
                        {t(feedbacks.length === 0 ? "map.noFeedback" : "map.noResults")}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-4 pb-2">
                    {[...days.entries()].map(([d, items]) => (
                        <div key={d}>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">
                                {dayLabel(d)}
                            </p>
                            <div className="flex flex-col gap-2.5">
                                {items.map((f) => {
                                    const n = places.get(placeKey(f))?.length ?? 1;
                                    return (
                                        <button
                                            key={f.id}
                                            onClick={() =>
                                                map.current?.flyTo([f.latitude, f.longitude], 14, {
                                                    duration: 0.6,
                                                })
                                            }
                                            className="w-full bg-white rounded-2xl flex items-start gap-3 px-3 py-2.5 active:bg-gray-50 text-left"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <p className="text-lg font-extrabold text-gray-900 leading-snug truncate">
                                                            {f.locationDisplay}
                                                        </p>
                                                        <span className="shrink-0 bg-brand text-white text-xs font-bold px-1.5 py-0 rounded-full">
                                                            {n}{" "}
                                                            {t(n === 1 ? "map.vote" : "map.votes")}
                                                        </span>
                                                    </div>
                                                    <span className="text-sm text-gray-400 shrink-0 pt-0.5">
                                                        {formatRelative(f.at, locale)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-400 truncate mt-0.5">
                                                    {f.locationName}
                                                </p>
                                                <div className="mt-1 space-y-1">
                                                    <p className="text-sm text-gray-500">
                                                        <span className="font-semibold text-gray-700">
                                                            {t("map.submittedBy")}{" "}
                                                        </span>
                                                        {f.userName || t("common.unknown")}
                                                    </p>
                                                    {f.notes && (
                                                        <>
                                                            <p className="text-sm font-semibold text-gray-700">
                                                                {t("map.notes")}
                                                            </p>
                                                            <div className="bg-slate-100 rounded-lg px-3 py-2">
                                                                <p className="text-sm text-gray-600 leading-relaxed">
                                                                    {f.notes}
                                                                </p>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title={t("map.filter")}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    {t("map.dateRange")}
                </p>
                <div className="flex flex-col gap-1 mb-5">
                    {RANGES.map((r) => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className="flex items-center justify-between px-3 py-3 rounded-xl active:bg-gray-50"
                        >
                            <span
                                className={`text-[15px] font-medium ${range === r ? "text-brand" : "text-gray-800"}`}
                            >
                                {t(RANGE_LABEL[r])}
                            </span>
                            {range === r && <Check size={16} className="text-brand" />}
                        </button>
                    ))}
                </div>
                {names.length > 0 && (
                    <>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                            {t("map.submittedByFilter")}
                        </p>
                        <div className="flex flex-col gap-1">
                            {names.map((n) => {
                                const on = people.includes(n);
                                return (
                                    <button
                                        key={n}
                                        onClick={() =>
                                            setPeople(
                                                on ? people.filter((p) => p !== n) : [...people, n],
                                            )
                                        }
                                        className="flex items-center justify-between px-3 py-3 rounded-xl active:bg-gray-50"
                                    >
                                        <span
                                            className={`text-[15px] font-medium ${on ? "text-brand" : "text-gray-800"}`}
                                        >
                                            {n}
                                        </span>
                                        {on && <Check size={16} className="text-brand" />}
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}
            </Sheet>
        </div>
    );
}
