import { formatMoney, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { Link } from "@tanstack/react-router";
import {
    CalendarClock,
    ChevronRight,
    Coins,
    HandCoins,
    IdCard,
    Percent,
    ReceiptText,
} from "lucide-react";

import { payDate, usePayPeriod, useSlug } from "./pay";

/** Days left in the period, counted in the store's calendar: `last day` or `3d left`. */
export function daysLeft(end: string, today: string): number {
    return Math.round((Date.parse(end) - Date.parse(today)) / 86_400_000);
}

/**
 * The old backoffice's Pay tab: the current period and what it owes so far (selling staff,
 * approved), then Operations and Configuration.
 */
export function PayHome() {
    const t = useT();
    const slug = useSlug();
    return (
        <div className="space-y-4">
            <PeriodCard />
            <SettingsGroup title={t("pay.operations")}>
                <SettingsRow
                    to={`/${slug}/pay/payouts`}
                    icon={<HandCoins {...rowIcon} />}
                    label={t("pay.payouts")}
                />
                <SettingsRow
                    to={`/${slug}/pay/staff`}
                    icon={<IdCard {...rowIcon} />}
                    label={t("pay.staffInfo")}
                />
            </SettingsGroup>
            <SettingsGroup title={t("pay.configuration")}>
                <SettingsRow
                    to={`/${slug}/pay/commission-types`}
                    icon={<Coins {...rowIcon} />}
                    label={t("pay.commissionTypes")}
                />
                <SettingsRow
                    to={`/${slug}/pay/staff-commissions`}
                    icon={<Percent {...rowIcon} />}
                    label={t("pay.staffCommissions")}
                />
                <SettingsRow
                    to={`/${slug}/pay/claim-types`}
                    icon={<ReceiptText {...rowIcon} />}
                    label={t("pay.claimTypes")}
                />
                {/* Last: set once and left alone. */}
                <SettingsRow
                    to={`/${slug}/pay/pay-schedule`}
                    icon={<CalendarClock {...rowIcon} />}
                    label={t("pay.schedule")}
                />
            </SettingsGroup>
        </div>
    );
}

function PeriodCard() {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const { data: p } = usePayPeriod();
    if (!p) return <div className="h-48 bg-white rounded-2xl" />;
    const left = daysLeft(p.end, localDate());
    const allApproved = p.reviewed > 0 && p.approved === p.reviewed;
    const missing = p.approved < p.reviewed;
    return (
        <div className="bg-white rounded-2xl p-2 space-y-2">
            <Link
                to="/$tenant/pay/payouts"
                params={{ tenant: slug }}
                className="w-full flex items-center gap-2.5 text-left active:opacity-60"
            >
                <div className="size-9 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
                    <CalendarClock size={20} className="text-brand" />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-500">{t("pay.nextPayout")}</p>
                    <p className="text-base font-bold text-gray-900">
                        {payDate(p.payoutDate, locale)}{" "}
                        <span className="font-mono text-sm font-semibold text-gray-500">
                            (
                            {left <= 0
                                ? t("pay.lastDay")
                                : t("pay.daysLeft").replace("{n}", String(left))}
                            )
                        </span>
                    </p>
                </div>
                <ChevronRight size={20} className="text-gray-400 shrink-0 ml-auto" />
            </Link>
            {/* Warm towards what is owed: amber and yellow the halves, red the sum (owed, not earned). */}
            <div className="bg-slate-50 rounded-xl p-2 grid grid-cols-4 gap-2">
                <Tile
                    label={t("pay.commissionOwed")}
                    value={formatMoney(p.commissions)}
                    tone="bg-amber-100 text-amber-600"
                />
                <Tile
                    label={t("pay.totalOwed")}
                    value={formatMoney(p.total)}
                    tone="bg-red-100 text-red-600"
                />
                <Tile
                    label={t("pay.claimsOwed")}
                    value={formatMoney(p.claims)}
                    tone="bg-yellow-100 text-yellow-700"
                />
                <Tile
                    label={t("pay.approved")}
                    value={`${p.approved}/${p.reviewed}`}
                    tone={
                        missing
                            ? "bg-amber-100 text-amber-600"
                            : allApproved
                              ? "bg-green-100 text-green-600"
                              : "bg-slate-200 text-slate-700"
                    }
                />
            </div>
        </div>
    );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
    const [bg, text] = tone.split(" ");
    return (
        <div className={`${bg} p-2 rounded-lg col-span-2`}>
            <p className="text-xs font-semibold text-gray-500">{label}</p>
            <p className={`text-lg font-bold ${text}`}>{value}</p>
        </div>
    );
}
