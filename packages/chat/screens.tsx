import { formatCalendarDay, formatCount, formatMoney, formatTime, weeks } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useApp } from "@tea-pos/shell/AppContext";
import { useSlug } from "@tea-pos/shell/tenant";
import { Avatar } from "@tea-pos/ui/Avatar";
import { isNight, weatherOf } from "@tea-pos/ui/weather";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { period } from "./events";
import type { ChatLink } from "./links";
import { linkTo } from "./links";

// A shared screen in chat is the screen itself, in short (task 078, owner: "a copy of the real
// screen"): the same layout and words as its page, live, as wide as the chat, and an Open button
// at its bottom. Each kind draws from the shape Go fills for it; a new kind is a component here.

type Person = NonNullable<ChatLink["day"]>["sellers"][number];

/** The full-width frame every screen in chat sits in, with its Open button. */
function Frame({
    children,
    open,
    openLabel,
}: {
    children: ReactNode;
    open: (() => void) | null;
    openLabel: MessageKey;
}) {
    const t = useT();
    return (
        // Inside the message's bubble (task 078: one bubble, a large one): a light panel, not a second bubble.
        <div className="my-1.5 w-full overflow-hidden rounded-xl bg-slate-50">
            <div className="space-y-3 p-3">{children}</div>
            {open && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        open();
                    }}
                    className="flex w-full items-center justify-center gap-1 border-t border-slate-200 py-3 text-[15px] font-semibold text-brand active:bg-slate-100"
                >
                    {t(openLabel)}
                    <ChevronRight size={18} />
                </button>
            )}
        </div>
    );
}

const Tile = ({ label, value, tone }: { label: string; value: string; tone: string }) => (
    <div className={`min-w-0 rounded-xl px-3 py-2 ${tone}`}>
        <p className="truncate text-xs font-medium">{label}</p>
        <p className="truncate text-[17px] font-bold">{value}</p>
    </div>
);

const STATUS: Record<string, [MessageKey, string]> = {
    paid: ["chat.paid", "bg-green-100 text-green-800"],
    pending: ["chat.pending", "bg-amber-100 text-amber-800"],
    skipped: ["chat.skipped", "bg-slate-100 text-gray-700"],
    open: ["chat.dayOpen", "bg-amber-100 text-amber-800"],
    closed: ["chat.dayClosed", "bg-slate-100 text-gray-700"],
};

function Status({ status }: { status: string }) {
    const t = useT();
    const s = STATUS[status];
    if (!s) return null;
    return (
        <span className={`shrink-0 rounded-sm px-1.5 text-[12px] font-semibold leading-5 ${s[1]}`}>
            {t(s[0])}
        </span>
    );
}

function People({
    people,
    value,
    more,
}: {
    people: Person[];
    value: (p: Person) => string;
    more?: number;
}) {
    const t = useT();
    return (
        <div>
            {people.map((p, i) => (
                <div
                    key={i}
                    className="flex items-center gap-2.5 border-b border-slate-100 py-2 last:border-b-0"
                >
                    <Avatar url={p.avatar} size={28} />
                    <span className="min-w-0 flex-1 truncate text-[15px] text-gray-900">
                        {p.name}
                    </span>
                    <span className="shrink-0 text-[15px] font-semibold text-gray-900">
                        {value(p)}
                    </span>
                    {p.status && <Status status={p.status} />}
                </div>
            ))}
            {!!more && (
                <p className="pt-1.5 text-[13px] text-gray-600">
                    {t("chat.andMore").replace("{n}", String(more))}
                </p>
            )}
        </div>
    );
}

/** A store's day, as the top of its day screen. */
function DayScreen({ d }: { d: NonNullable<ChatLink["day"]> }) {
    const t = useT();
    const locale = useLocale();
    return (
        <>
            <div>
                <div className="flex items-start justify-between gap-2">
                    <p className="text-[17px] font-bold text-gray-900">
                        {formatCalendarDay(d.date, locale, "long")}
                    </p>
                    <Status status={d.closed ? "closed" : "open"} />
                </div>
                <p className="text-[13px] text-gray-600">
                    {d.store}
                    {d.openedBy &&
                        ` · ${t("chat.openedBy")
                            .replace("{name}", d.openedBy)
                            .replace("{time}", d.openedAt ? formatTime(d.openedAt, locale) : "")}`}
                </p>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                <Tile
                    label={t("chat.sales")}
                    value={formatMoney(d.sales)}
                    tone="bg-green-50 text-green-900"
                />
                <Tile
                    label={t("chat.orders")}
                    value={formatCount(d.orders)}
                    tone="bg-violet-50 text-violet-900"
                />
                <Tile
                    label={t("chat.cupsLabel")}
                    value={formatCount(d.cups)}
                    tone="bg-orange-50 text-orange-900"
                />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
                <Tile
                    label={t("chat.expenses")}
                    value={formatMoney(d.expenses)}
                    tone="bg-red-50 text-red-900"
                />
                <Tile
                    label={t("chat.expected")}
                    value={formatMoney(d.expected)}
                    tone="bg-blue-50 text-blue-900"
                />
            </div>
            {d.counted !== undefined && d.counted !== null && (
                <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-amber-900">
                    <span className="text-xs font-medium">{t("chat.counted")}</span>
                    <span className="text-[15px] font-bold">
                        {formatMoney(d.counted)}
                        {d.counted !== d.expected && (
                            <span
                                className={`ml-1.5 text-xs ${d.counted < d.expected ? "text-red-700" : "text-green-700"}`}
                            >
                                {d.counted < d.expected ? "−" : "+"}
                                {formatMoney(Math.abs(d.counted - d.expected)).replace("Rp ", "")}
                            </span>
                        )}
                    </span>
                </div>
            )}
            {d.sellers.length > 0 && (
                <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-600">
                        {t("chat.whoWorked")}
                    </p>
                    <People
                        people={d.sellers}
                        value={(p) => t("chat.cups").replace("{n}", formatCount(p.value))}
                    />
                </div>
            )}
        </>
    );
}

/** A pay period, as the Pay tab at that week. */
function PeriodScreen({ p }: { p: NonNullable<ChatLink["period"]> }) {
    const t = useT();
    const locale = useLocale();
    return (
        <>
            <div className="text-center">
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-900">
                    {weeks(p.start, p.end, t("chat.week"))}
                </p>
                <p className="text-[17px] font-bold text-gray-900">
                    {formatCalendarDay(p.start, locale, "short")} –{" "}
                    {formatCalendarDay(p.end, locale, "short")}
                </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
                <Tile
                    label={t("chat.toPay")}
                    value={formatMoney(p.toPay)}
                    tone="bg-amber-50 text-amber-900"
                />
                <Tile
                    label={t("chat.paidTotal")}
                    value={formatMoney(p.paid)}
                    tone="bg-green-50 text-green-900"
                />
            </div>
            {p.toReview > 0 && (
                <p className="text-[13px] font-medium text-red-700">
                    {t("chat.toReview").replace("{n}", String(p.toReview))}
                </p>
            )}
            <People people={p.people} value={(x) => formatMoney(x.value)} more={p.more} />
        </>
    );
}

/** A payslip, as its top. */
function PayslipScreen({ s }: { s: NonNullable<ChatLink["payslip"]> }) {
    const t = useT();
    const locale = useLocale();
    return (
        <>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-[17px] font-bold text-gray-900">{s.person}</p>
                    <p className="text-[13px] text-gray-600">{period(s.start, s.end, locale)}</p>
                </div>
                <Status status={s.status} />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                <Tile
                    label={t("chat.orders")}
                    value={formatCount(s.orders)}
                    tone="bg-violet-50 text-violet-900"
                />
                <Tile
                    label={t("chat.cupsLabel")}
                    value={formatCount(s.cups)}
                    tone="bg-orange-50 text-orange-900"
                />
                <Tile
                    label={t("chat.totalPay")}
                    value={formatMoney(s.total)}
                    tone="bg-green-50 text-green-900"
                />
            </div>
            {s.paidAt && (
                <p className="text-[13px] text-gray-600">
                    {t("chat.paidOn")
                        .replace(
                            "{date}",
                            formatCalendarDay(s.paidAt.slice(0, 10), locale, "short"),
                        )
                        .replace("{name}", s.paidBy || "—")}
                </p>
            )}
            {s.receipt && (
                <img
                    src={s.receipt}
                    alt={t("chat.receipt")}
                    className="max-h-48 rounded-xl object-cover"
                />
            )}
        </>
    );
}

/** A release, as its What's new card: this app's lines, as bullet points. */
function ReleaseScreen({ link }: { link: ChatLink }) {
    const locale = useLocale();
    const { id: app } = useApp();
    const note = link.notes?.find((n) => n.apps.includes(app)) ?? link.notes?.[0];
    const lines = note?.lines[locale] ?? note?.lines.en ?? [];
    return (
        <>
            <p className="text-[17px] font-bold text-gray-900">{link.id}</p>
            {lines.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-[15px] text-gray-800">
                    {lines.map((l) => (
                        <li key={l}>{l}</li>
                    ))}
                </ul>
            )}
        </>
    );
}

/** Whether a link has a screen to draw for this reader (else the message line, or a chip). */
export const hasScreen = (link: ChatLink) =>
    !!(
        link.day ||
        link.period ||
        link.payslip ||
        (link.kind === "whats_new" && link.notes?.length)
    );

const OPEN: Partial<Record<ChatLink["kind"], MessageKey>> = {
    day: "chat.openDay",
    pay_period: "chat.openPeriod",
    payout: "chat.openPayslip",
    whats_new: "chat.openWhatsNew",
};

/**
 * A message's shared screen, full width: the screen itself when the reader may see it; null when
 * there is nothing to draw (the message line says enough).
 */
export function ScreenCard({ link }: { link: ChatLink }) {
    const slug = useSlug();
    const navigate = useNavigate();
    const { id: app } = useApp();
    const where =
        link.open && (app === "backoffice" || link.kind === "whats_new")
            ? linkTo(link, slug)
            : null;
    const open = where
        ? () =>
              void navigate({
                  to: where,
                  search: (link.kind === "whats_new" ? { v: link.id } : {}) as never,
              })
        : null;
    let body: ReactNode = null;
    if (link.day) body = <DayScreen d={link.day} />;
    else if (link.period) body = <PeriodScreen p={link.period} />;
    else if (link.payslip) body = <PayslipScreen s={link.payslip} />;
    else if (link.kind === "whats_new" && link.notes?.length) body = <ReleaseScreen link={link} />;
    if (!body) return null;
    return (
        <Frame open={open} openLabel={OPEN[link.kind] ?? "chat.openDay"}>
            {body}
        </Frame>
    );
}

type Hour = { hour: number; code: number; chance: number; temp: number };

/** Rain's proof (task 078): the coming hours, as the weather sheet draws them. */
export function RainCard({ hours }: { hours: Hour[] }) {
    const t = useT();
    if (!hours.length) return null;
    return (
        <Frame open={null} openLabel="chat.openDay">
            <div className="space-y-1">
                {hours.map((h, i) => {
                    const w = weatherOf(h.code, isNight(h.hour));
                    return (
                        <div
                            key={h.hour}
                            className={`flex items-center justify-between rounded-xl py-2 pr-3 pl-2.5 ${i === 0 ? "bg-blue-50" : "bg-white"}`}
                        >
                            <span
                                className={`w-16 font-semibold ${i === 0 ? "text-blue-500" : "text-sm text-gray-800"}`}
                            >
                                {i === 0 ? t("chat.now") : `${String(h.hour).padStart(2, "0")}:00`}
                            </span>
                            <span className="flex flex-1 items-center gap-1.5">
                                <w.icon size={22} className="text-gray-900" />
                                <span className="text-[14px] font-medium text-gray-600">
                                    {t(`weather.${w.key}` as MessageKey)}
                                </span>
                            </span>
                            {h.chance > 0 && (
                                <span className="mr-2 rounded-sm bg-cyan-400 px-1 py-0.5 text-xs font-bold text-white">
                                    {Math.round(h.chance)}%
                                </span>
                            )}
                            <span className="w-11 text-right text-sm font-semibold text-gray-900">
                                {Math.round(h.temp)}°C
                            </span>
                        </div>
                    );
                })}
            </div>
        </Frame>
    );
}
