import type { components } from "@tea-pos/api-client";
import { formatMoney, localDate } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";

import { daysLeft, daysLeftText, shortDay, weeks } from "./dates";
import { payDate, usePayPeriodAt, useSlug } from "./pay";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { ICON } from "@tea-pos/ui/icon";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { ListRow } from "@tea-pos/ui/ListRow";
import { Badge } from "@tea-pos/ui/Badge";
import { STEP_ARROW, stepIcon } from "@tea-pos/ui/MonthStepper";

type Person = components["schemas"]["Payout"];

/** What a person needs from the admin: review first, then ready, then settled. */
function group(p: Person): "toReview" | "ready" | "settled" {
    if (p.status !== "pending") return "settled";
    return p.pending > 0 ? "toReview" : "ready";
}

/**
 * The Pay tab's home: one period (‹ › flips between them) and each person it pays, grouped by
 * what needs you; a person opens their payslip. Pay settings sit at the bottom.
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
    const groups = (["toReview", "ready", "settled"] as const)
        .map((g) => ({ g, rows: people.filter((x) => group(x) === g) }))
        .filter((x) => x.rows.length > 0);
    const toPay = people.filter((x) => group(x) === "ready").length;

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
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-900">
                            {weeks(p.start, p.end, t("pay.week"))}
                        </p>
                        <p className="text-lg font-bold text-gray-900">
                            {shortDay(p.start, locale)} – {shortDay(p.end, locale)}
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
                <p className="mt-1 text-center text-sm text-gray-900">
                    {left <= 0 && toPay > 0
                        ? t("pay.payDay").replace("{n}", String(toPay))
                        : `${t("pay.paysOn").replace("{date}", payDate(p.payoutDate, locale))}${
                              left > 0 ? ` · ${daysLeftText(t, left)}` : ""
                          }`}
                </p>
                <p className="mt-1 text-center text-sm font-semibold text-gray-900">
                    {t("pay.owedLine").replace("{amount}", formatMoney(p.owed))}
                    {p.toReview > 0 && (
                        <span className="text-amber-600">
                            {" "}
                            · {t("pay.reviewCount").replace("{n}", String(p.toReview))}
                        </span>
                    )}
                </p>
            </div>

            {before && before.people.some((x) => x.status === "pending" && x.total > 0) && (
                <Link
                    to="/$tenant/pay"
                    params={{ tenant: slug }}
                    search={{ period: before.start }}
                    className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-amber-800 active:opacity-80"
                >
                    <span className="flex-1 text-sm font-semibold">
                        {shortDay(before.start, locale)} – {shortDay(before.end, locale)}:{" "}
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

            {groups.length === 0 && (
                <EmptyState title={t("pay.noPeople")} body={t("pay.noPeopleBody")} />
            )}
            {groups.map(({ g, rows }) => (
                <SettingsGroup key={g} title={`${t(`pay.${g}` as MessageKey)} (${rows.length})`}>
                    {rows.map((x) => (
                        <PersonRow key={x.id} person={x} start={p.start} />
                    ))}
                </SettingsGroup>
            ))}

            <SettingsGroup>
                <SettingsRow
                    to={`/${slug}/pay/settings`}
                    icon={<Settings {...rowIcon} />}
                    label={t("pay.settingsTitle")}
                />
            </SettingsGroup>
        </div>
    );
}

/** A person in the period, as v1's lists: their photo, name, a badge for what is next, the amount. */
function PersonRow({ person: x, start }: { person: Person; start: string }) {
    const t = useT();
    const slug = useSlug();
    const navigate = useNavigate();
    const badge =
        x.status !== "pending"
            ? t(x.status === "skipped" ? "pay.skipped" : "pay.paid")
            : x.pending > 0
              ? t("pay.waiting").replace("{n}", String(x.pending))
              : t("pay.readyBadge");
    return (
        <ListRow
            onClick={() =>
                void navigate({
                    to: "/$tenant/pay/$start/$userId",
                    params: { tenant: slug, start, userId: x.userId },
                })
            }
            leading={<Avatar url={x.avatarUrl} square />}
            title={x.name}
            subtitle={
                <span className="flex pt-1">
                    <Badge>{badge}</Badge>
                </span>
            }
            trailing={
                <span className="flex items-center gap-1 shrink-0">
                    <span className="text-base font-bold text-gray-900">
                        {formatMoney(x.total)}
                    </span>
                    <ChevronRight size={ICON} strokeWidth={2.5} className="text-brand/90" />
                </span>
            }
        />
    );
}
