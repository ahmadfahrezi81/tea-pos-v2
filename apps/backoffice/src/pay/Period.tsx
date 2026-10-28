import type { components } from "@tea-pos/api-client";
import { formatMoney, localDate } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { avatar } from "@tea-pos/shell/avatar";
import { HeaderActions } from "@tea-pos/shell/HeaderActions";
import { Link } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, UserCircle } from "lucide-react";

import { daysLeft, shortDay } from "./dates";
import { payDate, usePayPeriodAt, useSlug } from "./pay";

type Person = components["schemas"]["Payout"];

/** What a person needs from the admin: review first, then ready, then settled. */
function group(p: Person): "toReview" | "ready" | "settled" {
    if (p.status !== "pending") return "settled";
    return p.pending > 0 ? "toReview" : "ready";
}

/**
 * The Pay tab's home: one period (‹ › flips between them) and each person it pays, grouped by
 * what needs you; a person opens their payslip. Settings sit behind the ⚙.
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
                <HeaderActions actions={[{ kind: "settings", to: `/${slug}/pay/settings` }]} />
                <div className="h-24 rounded-2xl bg-white" />
                <div className="h-40 rounded-2xl bg-white" />
            </div>
        );

    const left = daysLeft(p.payoutDate, today);
    // Staff with no commission rate and nothing owed or waiting are noise here, as in v1's list.
    const people = p.people.filter((x) => !x.nonSeller || x.total > 0 || x.pending > 0);
    const groups = (["toReview", "ready", "settled"] as const)
        .map((g) => ({ g, rows: people.filter((x) => group(x) === g) }))
        .filter((x) => x.rows.length > 0);
    const toPay = people.filter((x) => group(x) === "ready").length;
    const arrow = "size-9 flex items-center justify-center rounded-xl active:bg-slate-100";

    return (
        <div className="space-y-4">
            <HeaderActions actions={[{ kind: "settings", to: `/${slug}/pay/settings` }]} />

            <div className="rounded-2xl bg-white p-3">
                <div className="flex items-center justify-between">
                    <Link
                        to="/$tenant/pay/$start"
                        params={{ tenant: slug, start: p.previous }}
                        replace
                        className={arrow}
                        aria-label="‹"
                    >
                        <ChevronLeft size={22} />
                    </Link>
                    <p className="text-lg font-bold text-gray-900">
                        {shortDay(p.start, locale)} – {shortDay(p.end, locale)}
                    </p>
                    {p.next ? (
                        <Link
                            to="/$tenant/pay/$start"
                            params={{ tenant: slug, start: p.next }}
                            replace
                            className={arrow}
                            aria-label="›"
                        >
                            <ChevronRight size={22} />
                        </Link>
                    ) : (
                        <span className="size-9" />
                    )}
                </div>
                <p className="mt-1 text-center text-sm text-gray-500">
                    {left <= 0 && toPay > 0
                        ? t("pay.payDay").replace("{n}", String(toPay))
                        : `${t("pay.paysOn").replace("{date}", payDate(p.payoutDate, locale))}${
                              left > 0
                                  ? ` · ${t("pay.daysLeftLong").replace("{n}", String(left))}`
                                  : ""
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
                    to="/$tenant/pay/$start"
                    params={{ tenant: slug, start: before.start }}
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
                    <ChevronRight size={20} />
                </Link>
            )}

            {groups.length === 0 && (
                <p className="py-10 text-center text-gray-400">{t("pay.noPeople")}</p>
            )}
            {groups.map(({ g, rows }) => (
                <section key={g} className="space-y-2">
                    <p className="px-1 text-sm font-semibold text-gray-500">
                        {t(`pay.${g}` as MessageKey)} ({rows.length})
                    </p>
                    <div className="overflow-hidden rounded-2xl bg-white">
                        {rows.map((x, i) => (
                            <PersonRow
                                key={x.id}
                                person={x}
                                start={p.start}
                                last={i === rows.length - 1}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function PersonRow({ person: x, start, last }: { person: Person; start: string; last: boolean }) {
    const t = useT();
    const slug = useSlug();
    return (
        <Link
            to="/$tenant/pay/$start/$userId"
            params={{ tenant: slug, start, userId: x.userId }}
            className={`flex items-center gap-3 p-3 active:bg-gray-50 ${last ? "" : "border-b border-gray-100"}`}
        >
            {x.avatarUrl ? (
                <img
                    src={avatar(x.avatarUrl)}
                    alt=""
                    width={36}
                    height={36}
                    referrerPolicy="no-referrer"
                    className="size-9 shrink-0 rounded-full object-cover"
                />
            ) : (
                <UserCircle size={36} className="shrink-0 text-gray-400" />
            )}
            <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-gray-900">{x.name}</p>
                {x.pending > 0 && (
                    <p className="text-xs text-amber-600">
                        {t("pay.waiting").replace("{n}", String(x.pending))}
                    </p>
                )}
                {x.status !== "pending" && (
                    <p className="text-xs text-gray-500">
                        {t(x.status === "skipped" ? "pay.skipped" : "pay.paid")}
                    </p>
                )}
            </div>
            <span className="shrink-0 font-semibold text-gray-900">{formatMoney(x.total)}</span>
            {group(x) === "ready" && <Check size={18} className="shrink-0 text-green-600" />}
        </Link>
    );
}
