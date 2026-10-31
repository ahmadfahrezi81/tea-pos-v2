import type { components } from "@tea-pos/api-client";
import { formatCalendarDay, formatMoney, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, CircleHelp, Settings } from "lucide-react";

import { daysLeft, daysLeftText, weeks } from "./dates";
import { payDate, usePayPeriodAt } from "./pay";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { ICON } from "@tea-pos/ui/icon";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { Badge } from "@tea-pos/ui/Badge";
import { STEP_ARROW, stepIcon } from "@tea-pos/ui/MonthStepper";
import { ListSection } from "@tea-pos/ui/ListSection";
import { Tile } from "@tea-pos/ui/Tile";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useSlug } from "@tea-pos/shell/tenant";

type Person = components["schemas"]["Payout"];

/** A person the admin can pay now: nothing left to review, not yet settled. */
const isReady = (p: Person) => p.status === "pending" && p.pending === 0;

/**
 * The Pay tab's home: one period (‹ › flips between them), its pay date, and each person's numbers
 * up front, those to review first, then those ready, then Done; a card opens the payslip.
 */
export function PeriodHome({ start }: { start: string }) {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const navigate = useNavigate();
    const card = useRef<HTMLDivElement>(null);
    const { data: p } = usePayPeriodAt(start);
    // From the current period, the one before while anyone in it is still unpaid: pay day lands there.
    const { data: before } = usePayPeriodAt(start === "current" && p ? p.previous : "");
    const today = localDate();

    if (!p)
        return (
            <div className="space-y-3">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-40 rounded-2xl" />
            </div>
        );

    const left = daysLeft(p.payoutDate, today);
    // Staff with no commission rate and nothing owed or waiting are noise here, as in v1's list.
    const people = p.people.filter((x) => !x.nonSeller || x.total > 0 || x.pending > 0);
    const open = people.filter((x) => x.status === "pending").sort((a, b) => b.pending - a.pending);
    const done = people.filter((x) => x.status !== "pending");
    const toPay = people.filter(isReady).length;
    const toSend = open.reduce((n, x) => n + x.total, 0);
    const paid = done.reduce((n, x) => n + (x.status === "paid" ? x.total : 0), 0);
    const allPaid = open.length === 0 && paid > 0;
    const waiting = open.reduce((n, x) => n + x.pending, 0);
    // How the period stands, under its pay date; nothing when there is nothing to say.
    const status = allPaid
        ? t("pay.paid")
        : left > 0
          ? daysLeftText(t, left)
          : toPay > 0
            ? t("pay.payDay").replace("{n}", String(toPay))
            : waiting > 0
              ? t("pay.waiting").replace("{n}", String(waiting))
              : "";

    const go = (period: string) =>
        void navigate({
            to: "/$tenant/pay",
            params: { tenant: slug },
            search: { period },
            replace: true,
        });
    // Swiping the period card changes period; only here, so the page scrolls as ever.
    const swipe = {
        start: (e: ReactPointerEvent) => {
            const el = card.current;
            if (!el || (e.target as Element).closest("a")) return;
            const { clientX: x0, clientY: y0 } = e;
            let dx = 0;
            let dy = 0;
            const move = (m: PointerEvent) => {
                dx = m.clientX - x0;
                dy = m.clientY - y0;
                // The card leans the way it can go, and barely past the current period.
                const room = dx < 0 && !p.next ? 0.05 : 0.3;
                el.style.transition = "none";
                el.style.transform = `translateX(${dx * room}px)`;
            };
            const end = (u: PointerEvent) => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", end);
                window.removeEventListener("pointercancel", end);
                el.style.transition = "transform 200ms ease-out";
                el.style.transform = "";
                if (u.type !== "pointerup" || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy))
                    return;
                if (dx > 0) go(p.previous);
                else if (p.next) go(p.next);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", end);
            window.addEventListener("pointercancel", end);
        },
    };

    return (
        <div className="space-y-4">
            <div
                ref={card}
                onPointerDown={swipe.start}
                className="rounded-2xl bg-white p-3 space-y-3 touch-pan-y"
            >
                <div className="flex items-center justify-between">
                    <Link
                        to="/$tenant/pay"
                        params={{ tenant: slug }}
                        search={{ period: p.previous }}
                        replace
                        className={STEP_ARROW}
                        aria-label="‹"
                    >
                        <ChevronLeft {...stepIcon} />
                    </Link>
                    <div className="text-center">
                        <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-900">
                            {weeks(p.start, p.end, t("pay.week"))}
                        </p>
                        <p className="text-lg font-bold text-gray-900">
                            {formatCalendarDay(p.start, locale, "short")} –{" "}
                            {formatCalendarDay(p.end, locale, "short")}
                        </p>
                    </div>
                    {p.next ? (
                        <Link
                            to="/$tenant/pay"
                            params={{ tenant: slug }}
                            search={{ period: p.next }}
                            replace
                            className={STEP_ARROW}
                            aria-label="›"
                        >
                            <ChevronRight {...stepIcon} />
                        </Link>
                    ) : (
                        <span className="size-11 shrink-0" />
                    )}
                </div>
                {people.length > 0 && (
                    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-xl bg-slate-100 p-2.5">
                        <p className="truncate text-sm font-medium text-gray-900">
                            {t("pay.totalPayout")}
                        </p>
                        <p className="text-right text-sm font-medium text-gray-900">
                            {payDate(p.payoutDate, locale)}
                        </p>
                        <p className="truncate text-lg font-bold leading-tight text-green-600">
                            {formatMoney(allPaid ? paid : toSend)}
                        </p>
                        {status && (
                            <span
                                className={`justify-self-end rounded-lg px-2 py-0.5 text-sm font-bold ${allPaid ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}
                            >
                                {status}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {before && before.people.some((x) => x.status === "pending" && x.total > 0) && (
                <Link
                    to="/$tenant/pay"
                    params={{ tenant: slug }}
                    search={{ period: before.start }}
                    className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-amber-800 active:opacity-80"
                >
                    <span className="flex-1 text-sm font-semibold">
                        {formatCalendarDay(before.start, locale, "short")} –{" "}
                        {formatCalendarDay(before.end, locale, "short")}:{" "}
                        {t("pay.payDay").replace(
                            "{n}",
                            String(
                                before.people.filter((x) => x.status === "pending" && x.total > 0)
                                    .length,
                            ),
                        )}
                    </span>
                    <ChevronRight size={ICON} />
                </Link>
            )}

            {people.length === 0 && (
                <EmptyState title={t("pay.noPeople")} body={t("pay.noPeopleBody")} />
            )}
            {open.length > 0 && (
                <ListSection title={t("pay.payoutsList")} count={open.length}>
                    {open.map((x) => (
                        <PersonCard key={x.id} person={x} start={p.start} />
                    ))}
                </ListSection>
            )}
            {done.length > 0 && (
                <ListSection title={t("pay.done")} count={done.length}>
                    {done.map((x) => (
                        <PersonCard key={x.id} person={x} start={p.start} />
                    ))}
                </ListSection>
            )}

            <SettingsGroup>
                <SettingsRow
                    to={`/${slug}/pay/settings`}
                    icon={<Settings {...rowIcon} />}
                    label={t("pay.settingsTitle")}
                />
                <SettingsRow
                    to={`/${slug}/pay/help`}
                    icon={<CircleHelp {...rowIcon} />}
                    label={t("pay.helpTitle")}
                />
            </SettingsGroup>
        </div>
    );
}

const plain = (amount: number) => formatMoney(amount).replace(/^Rp\s*/, "");

/** A person in the period: who, what is next and the total up top, what makes it up as tiles. */
function PersonCard({ person: x, start }: { person: Person; start: string }) {
    const t = useT();
    const slug = useSlug();
    const reviewed = x.approved + x.pending;
    return (
        <Link
            to="/$tenant/pay/$start/$userId"
            params={{ tenant: slug, start, userId: x.userId }}
            className="block bg-white rounded-xl p-3 space-y-2.5 active:bg-gray-50"
        >
            <div className="flex items-center gap-3">
                <Avatar url={x.avatarUrl} />
                <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-bold text-gray-900 truncate">{x.name}</p>
                    <div className="flex flex-wrap gap-1">
                        <Badge>
                            {x.status !== "pending"
                                ? t(x.status === "skipped" ? "pay.skipped" : "pay.paid")
                                : x.pending > 0
                                  ? t("pay.waiting").replace("{n}", String(x.pending))
                                  : t("pay.readyBadge")}
                        </Badge>
                        {reviewed > 0 && (
                            <Badge>
                                {x.approved}/{reviewed} ✓
                            </Badge>
                        )}
                    </div>
                </div>
                <div className="shrink-0 space-y-1 text-right">
                    <p className="text-xs font-semibold text-gray-900">{t("pay.total")}</p>
                    <p className="font-bold text-green-600">{formatMoney(x.total)}</p>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                <Tile label={t("pay.cups")} value={String(x.cups)} className="bg-blue-100" />
                <Tile
                    label={t("pay.commission")}
                    value={plain(x.commissions)}
                    className="bg-teal-100"
                />
                <Tile label={t("pay.claims")} value={plain(x.claims)} className="bg-purple-100" />
            </div>
        </Link>
    );
}
