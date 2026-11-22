import { formatCalendarDay, formatCount, formatMoney } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useApp } from "@tea-pos/shell/AppContext";
import { useSlug } from "@tea-pos/shell/tenant";
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
export function linkTo(l: ChatLink, slug: string): string | null {
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
        link.open && (app === "backoffice" || link.kind === "whats_new")
            ? linkTo(link, slug)
            : null;

    let title = t(label);
    let line = link.open ? "" : t(app === "backoffice" ? "chat.linkGone" : "chat.linkInBackoffice");
    if (link.open)
        switch (link.kind) {
            case "day":
                title = link.store ?? title;
                line = [
                    link.date ? formatCalendarDay(link.date, locale, "short") : "",
                    t("chat.cups").replace("{n}", formatCount(link.cups ?? 0)),
                ]
                    .filter(Boolean)
                    .join(" · ");
                break;
            case "pay_period":
                title = `${t(label)} ${period(link.start ?? "", link.end ?? "", locale)}`;
                line = [
                    formatMoney(link.total ?? 0),
                    t("chat.people").replace("{n}", formatCount(link.people ?? 0)),
                ]
                    .filter(Boolean)
                    .join(" · ");
                break;
            case "payout":
                title = link.person ?? title;
                line = [
                    period(link.start ?? "", link.end ?? "", locale),
                    formatMoney(link.total ?? 0),
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
    const box = `my-1 flex w-full min-w-52 items-center gap-2.5 rounded-xl p-2 text-left ${onDark ? "bg-black/10" : "bg-white ring-1 ring-black/5"}`;
    const content = body;
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
