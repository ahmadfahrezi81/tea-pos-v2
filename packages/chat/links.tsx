import { formatCalendarDay, formatCount, formatMoney } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useApp } from "@tea-pos/shell/AppContext";
import { useSlug } from "@tea-pos/shell/tenant";
import { Avatar } from "@tea-pos/ui/Avatar";
import { useNavigate } from "@tanstack/react-router";
import {
    Banknote,
    CalendarDays,
    ChevronRight,
    Sparkles,
    Wallet,
    type LucideIcon,
} from "lucide-react";

import { period } from "./events";
import type { ChatMessage } from "./queries";

// Links between the apps (Step 75): a message points at a screen by {kind, id}; Go fills the
// card when the reader may open it. A new kind is a line in KINDS, in `to`, and in Go's twin.

export type ChatLink = NonNullable<ChatMessage["link"]>;

const KINDS: Record<ChatLink["kind"], { icon: LucideIcon; label: MessageKey }> = {
    day: { icon: CalendarDays, label: "chat.linkDay" },
    pay_period: { icon: Wallet, label: "chat.linkPayPeriod" },
    payout: { icon: Banknote, label: "chat.linkPayout" },
    whats_new: { icon: Sparkles, label: "chat.linkWhatsNew" },
};

/** A link's kind in words: "Payout". */
export const linkLabel = (kind: ChatLink["kind"]): MessageKey => (KINDS[kind] ?? KINDS.day).label;

/** Where a link opens, under the tenant; only the backoffice has these screens for now. */
function to(l: ChatLink, slug: string): string | null {
    switch (l.kind) {
        case "day":
            return l.storeId ? `/${slug}/store/${l.storeId}/analytics/days/${l.id}` : null;
        case "pay_period":
            return `/${slug}/pay/${l.id}`;
        case "payout":
            return l.start && l.userId ? `/${slug}/pay/${l.start}/${l.userId}` : null;
        case "whats_new":
            return `/${slug}/whats-new`;
    }
}

/** A shared screen in a bubble: a card that opens it, or a plain chip when the reader can't. */
export function LinkCard({ link, onDark }: { link: ChatLink; onDark?: boolean }) {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const navigate = useNavigate();
    const { id: app } = useApp();
    const { icon: Icon, label } = KINDS[link.kind] ?? KINDS.day;
    const where =
        link.open && (app === "backoffice" || link.kind === "whats_new") ? to(link, slug) : null;

    let title = t(label);
    let line = link.open ? "" : t(app === "backoffice" ? "chat.linkGone" : "chat.linkInBackoffice");
    if (link.open)
        switch (link.kind) {
            case "day":
                title = link.store ?? title;
                // With a preview its numbers are below: the line says only which day.
                line = [
                    link.date ? formatCalendarDay(link.date, locale, "short") : "",
                    link.preview ? "" : t("chat.cups").replace("{n}", formatCount(link.cups ?? 0)),
                ]
                    .filter(Boolean)
                    .join(" · ");
                break;
            case "pay_period":
                title = `${t(label)} ${period(link.start ?? "", link.end ?? "", locale)}`;
                line = [
                    link.preview ? "" : formatMoney(link.total ?? 0),
                    t("chat.people").replace("{n}", formatCount(link.people ?? 0)),
                ]
                    .filter(Boolean)
                    .join(" · ");
                break;
            case "payout":
                title = link.person ?? title;
                line = [
                    period(link.start ?? "", link.end ?? "", locale),
                    link.preview ? "" : formatMoney(link.total ?? 0),
                ]
                    .filter(Boolean)
                    .join(" · ");
                break;
            case "whats_new":
                line = link.id;
                break;
        }

    const body = (
        <>
            <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${onDark ? "bg-white/20" : "bg-brand/10 text-brand"}`}
            >
                <Icon size={18} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold leading-5">{title}</span>
                {line && (
                    <span
                        className={`block truncate text-[13px] leading-5 ${onDark ? "text-white/90" : "text-gray-600"}`}
                    >
                        {line}
                    </span>
                )}
            </span>
            {where && <ChevronRight size={18} className="shrink-0 opacity-60" />}
        </>
    );
    const preview = link.preview;
    const head = <span className="flex w-full items-center gap-2.5">{body}</span>;
    const box = `my-1 flex flex-col gap-2 rounded-xl p-2 text-left ${preview ? "w-68 max-w-full" : "w-full min-w-52"} ${onDark ? "bg-black/10" : "bg-white ring-1 ring-black/5"}`;
    const content = (
        <>
            {head}
            {preview && <Preview preview={preview} />}
        </>
    );
    if (!where) return <div className={box}>{content}</div>;
    return (
        <button
            type="button"
            className={`${box} active:opacity-70`}
            onClick={(e) => {
                e.stopPropagation();
                void navigate({
                    to: where,
                    search: (link.kind === "whats_new" ? { v: link.id } : {}) as never,
                });
            }}
        >
            {content}
        </button>
    );
}

type Preview = NonNullable<ChatLink["preview"]>;

const STAT: Record<Preview["stats"][number]["label"], MessageKey> = {
    sales: "chat.stat.sales",
    cups: "chat.stat.cups",
    orders: "chat.stat.orders",
    expenses: "chat.stat.expenses",
    expected: "chat.stat.expected",
    counted: "chat.stat.counted",
    total: "chat.stat.total",
    paid: "chat.stat.paid",
    toPay: "chat.stat.toPay",
    people: "chat.stat.people",
    commissions: "chat.stat.commissions",
    claims: "chat.stat.claims",
};

const STATE: Record<NonNullable<Preview["status"]>, [MessageKey, string]> = {
    open: ["chat.state.open", "bg-amber-100 text-amber-800"],
    closed: ["chat.state.closed", "bg-slate-100 text-gray-700"],
    paid: ["chat.state.paid", "bg-green-100 text-green-800"],
    pending: ["chat.state.pending", "bg-amber-100 text-amber-800"],
    skipped: ["chat.state.skipped", "bg-slate-100 text-gray-700"],
};

function State({ status }: { status: NonNullable<Preview["status"]> }) {
    const t = useT();
    const [key, tone] = STATE[status];
    return (
        <span className={`shrink-0 rounded-sm px-1.5 text-[11px] font-semibold leading-5 ${tone}`}>
            {t(key)}
        </span>
    );
}

/**
 * The screen in small (owner: "a screenshot of the page"): its numbers, then who, from one shape
 * Go fills for every kind, so a new kind needs no new card.
 */
function Preview({ preview }: { preview: Preview }) {
    const t = useT();
    const value = (v: number, unit: string) => (unit === "money" ? formatMoney(v) : formatCount(v));
    return (
        <span className="flex w-full flex-col gap-2">
            {preview.status && (
                <span className="-mt-1 flex">
                    <State status={preview.status} />
                </span>
            )}
            <span className="grid grid-cols-2 gap-1.5">
                {preview.stats.map((s) => (
                    <span key={s.label} className="min-w-0 rounded-lg bg-slate-50 px-2 py-1.5">
                        <span className="block truncate text-[11px] leading-4 text-gray-600">
                            {t(STAT[s.label])}
                        </span>
                        <span className="block truncate text-[14px] font-semibold leading-5 text-gray-900">
                            {value(s.value, s.unit)}
                        </span>
                    </span>
                ))}
            </span>
            {!!preview.rows?.length && (
                <span className="flex flex-col divide-y divide-slate-100">
                    {preview.rows.map((r, i) => (
                        <span key={i} className="flex items-center gap-2 py-1.5">
                            <Avatar url={r.avatar} size={20} />
                            <span className="min-w-0 flex-1 truncate text-[13px] text-gray-900">
                                {r.name}
                            </span>
                            {r.status && <State status={r.status} />}
                            <span className="shrink-0 text-[13px] font-semibold text-gray-900">
                                {r.unit === "cups"
                                    ? t("chat.cups").replace("{n}", formatCount(r.value))
                                    : formatMoney(r.value)}
                            </span>
                        </span>
                    ))}
                    {!!preview.more && (
                        <span className="pt-1.5 text-[12px] text-gray-600">
                            {t("chat.andMore").replace("{n}", String(preview.more))}
                        </span>
                    )}
                </span>
            )}
        </span>
    );
}
