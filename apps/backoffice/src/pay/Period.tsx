import type { components } from "@tea-pos/api-client";
import { formatCalendarDay, formatMoney, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import { Link } from "@tanstack/react-router";
import { CalendarClock, ChevronLeft, ChevronRight, CircleHelp, Settings } from "lucide-react";

import { daysLeft, daysLeftText, weeks } from "./dates";
import { payDate, usePayPeriodAt } from "./pay";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { ICON } from "@tea-pos/ui/icon";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { Badge } from "@tea-pos/ui/Badge";
import { STEP_ARROW, stepIcon } from "@tea-pos/ui/MonthStepper";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";
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

    return (
        <div className="space-y-4">
            <div className="rounded-2xl bg-white p-3">
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
            </div>

            <div className="bg-white p-3 rounded-2xl flex items-center gap-3">
                <div className="size-11 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                    <CalendarClock size={ICON} className="text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                        {left <= 0 && toPay > 0
                            ? t("pay.payDay").replace("{n}", String(toPay))
                            : t(left > 0 ? "pay.nextPayout" : "pay.payDate")}
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                        {payDate(p.payoutDate, locale)}
                    </p>
                </div>
                {left > 0 && <Badge>{daysLeftText(t, left)}</Badge>}
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
            {open.map((x) => (
                <PersonCard key={x.id} person={x} start={p.start} />
            ))}
            {done.length > 0 && (
                <div className="space-y-2">
                    {open.length > 0 && <SectionLabel>{t("pay.done")}</SectionLabel>}
                    {done.map((x) => (
                        <PersonCard key={x.id} person={x} start={p.start} />
                    ))}
                </div>
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

const Tile = ({
    label,
    value,
    className,
}: {
    label: string;
    value: string | number;
    className: string;
}) => (
    <div className={`p-2 rounded-lg ${className}`}>
        <p className="text-xs font-semibold text-gray-900">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
);

/** A person in the period, as v1's card: who, what is next, and the numbers before any tap. */
function PersonCard({ person: x, start }: { person: Person; start: string }) {
    const t = useT();
    const slug = useSlug();
    const reviewed = x.approved + x.pending;
    return (
        <Link
            to="/$tenant/pay/$start/$userId"
            params={{ tenant: slug, start, userId: x.userId }}
            className="block bg-white rounded-2xl p-3 space-y-3 active:bg-gray-50"
        >
            <div className="flex items-center gap-3">
                <Avatar url={x.avatarUrl} square />
                <p className="flex-1 min-w-0 text-lg font-bold text-gray-900 truncate">{x.name}</p>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge>
                        {x.status !== "pending"
                            ? t(x.status === "skipped" ? "pay.skipped" : "pay.paid")
                            : x.pending > 0
                              ? t("pay.waiting").replace("{n}", String(x.pending))
                              : t("pay.readyBadge")}
                    </Badge>
                    {reviewed > 0 && (
                        <span className="text-xs font-medium text-gray-900">
                            {t("pay.approvedOf")
                                .replace("{a}", String(x.approved))
                                .replace("{n}", String(reviewed))}
                        </span>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-4 gap-2 bg-slate-50 rounded-xl p-2">
                <Tile label={t("pay.orders")} value={x.orders} className="bg-orange-100" />
                <Tile label={t("pay.cups")} value={x.cups} className="bg-blue-100" />
                <Tile
                    label={t("pay.commission")}
                    value={formatMoney(x.commissions)}
                    className="bg-teal-100 col-span-2"
                />
                <Tile
                    label={t("pay.claims")}
                    value={formatMoney(x.claims)}
                    className="bg-purple-100 col-span-2"
                />
                <Tile
                    label={t("pay.total")}
                    value={formatMoney(x.total)}
                    className="bg-green-100 col-span-2"
                />
            </div>
        </Link>
    );
}
