import type { components } from "@tea-pos/api-client";
import { addDays, formatCalendarDay, formatMoney, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { ActionButton } from "@tea-pos/ui/ActionButton";
import { CopyButton } from "@tea-pos/ui/CopyButton";
import { Link, useLocation } from "@tanstack/react-router";
import { useAccess } from "@tea-pos/shell/tenant";
import { AlertTriangle, Check, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { daysLeft, daysLeftText, weeks } from "./dates";
import { decisions, payDate, usePayslip, usePayWrite } from "./pay";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Dialog, Drawer } from "@tea-pos/ui/Drawer";
import { ICON } from "@tea-pos/ui/icon";
import { FooterSlot } from "@tea-pos/shell/FooterSlotContext";
import { Badge } from "@tea-pos/ui/Badge";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";

type Slip = components["schemas"]["Payslip"];
type Row = { id: string; date: string; status: string; amount: number };

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Confirm = {
    kind: "commission" | "claim" | "day";
    /** The row, or for a day the date. */
    id: string;
    status: "approved" | "rejected";
    label: string;
    amount: number;
    count?: number;
};

/**
 * A person's payslip, as the old backoffice: what is pending, the totals, the payment details,
 * the days worked, and each day's commissions and claims to approve or reject (one, or a day's
 * pending ones at once). Pay opens once nothing is pending (Step 23).
 */
export function Payslip({ id }: { id: string }) {
    const t = useT();
    const locale = useLocale();
    const pathname = useLocation({ select: (l) => l.pathname });
    const { data: slip } = usePayslip(id);
    const { canWrite } = useAccess();
    const [confirm, setConfirm] = useState<Confirm | null>(null);
    const [warningDismissed, setWarningDismissed] = useState(false);
    const [showProof, setShowProof] = useState(false);
    const commission = usePayWrite(decisions.commission);
    const claim = usePayWrite(decisions.claim);
    const day = usePayWrite(decisions.day);
    if (!slip)
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} delay={i * 80} className="h-24 rounded-xl" />
                ))}
            </div>
        );

    const byDate = <T extends { date: string }>(rows: T[]) =>
        rows.reduce<Record<string, T[]>>((acc, r) => ((acc[r.date] ??= []).push(r), acc), {});
    const commissionsOn = byDate(slip.commissionRows);
    const claimsOn = byDate(slip.claimRows);
    const dates = [...new Set([...Object.keys(commissionsOn), ...Object.keys(claimsOn)])].sort(
        (a, b) => b.localeCompare(a),
    );
    const pendingDates = dates.filter((d) =>
        [...(commissionsOn[d] ?? []), ...(claimsOn[d] ?? [])].some((r) => r.status === "pending"),
    );
    const worked = new Set(slip.commissionRows.map((c) => c.date));
    const left = daysLeft(slip.end, localDate());
    const isSkip = slip.total === 0;

    const decide = async () => {
        if (!confirm) return false;
        const c = confirm;
        if (c.kind === "day") await day.mutateAsync({ id, date: c.id, status: c.status });
        else if (c.kind === "commission")
            await commission.mutateAsync({ id: c.id, status: c.status });
        else await claim.mutateAsync({ id: c.id, status: c.status });
        setConfirm(null);
    };
    const toggles = (r: Row, kind: "commission" | "claim", label: string) => (
        <div className="flex gap-1.5 shrink-0">
            {(["rejected", "approved"] as const).map((s) => (
                <button
                    key={s}
                    aria-label={t(s === "approved" ? "pay.approve" : "pay.reject")}
                    onClick={() =>
                        setConfirm({ kind, id: r.id, status: s, label, amount: r.amount })
                    }
                    disabled={slip.status !== "pending" || !canWrite}
                    className={`p-2 rounded-lg disabled:opacity-40 ${
                        r.status === s
                            ? s === "approved"
                                ? "bg-green-100 text-green-600"
                                : "bg-red-100 text-red-600"
                            : "bg-gray-100 text-gray-400"
                    }`}
                >
                    {s === "approved" ? <Check size={15} /> : <X size={15} />}
                </button>
            ))}
        </div>
    );
    const detail = (label: string, value: ReactNode) => (
        <div key={label} className="flex justify-between items-center">
            <span className="text-gray-900">{label}</span>
            <span className="font-medium text-gray-800">{value}</span>
        </div>
    );
    const days = Array.from(
        { length: Math.round((Date.parse(slip.end) - Date.parse(slip.start)) / 86_400_000) + 1 },
        (_, i) => addDays(slip.start, i),
    );

    return (
        <div className="space-y-3">
            {pendingDates.length > 0 && !warningDismissed && (
                <div className="bg-red-100 p-3.5 rounded-xl">
                    <div className="flex items-start justify-between mb-2">
                        <button
                            className="flex items-center gap-2 text-left active:opacity-60"
                            onClick={() =>
                                document
                                    .getElementById(`day-${pendingDates[pendingDates.length - 1]}`)
                                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                            }
                        >
                            <AlertTriangle size={ICON} className="text-red-600" />
                            <h3 className="font-semibold text-red-800">
                                {t("pay.daysPending").replace("{n}", String(pendingDates.length))}
                            </h3>
                        </button>
                        <button
                            onClick={() => setWarningDismissed(true)}
                            className="p-1 -mt-1 -mr-2 rounded-full text-red-600 active:opacity-60"
                            aria-label={t("common.close")}
                        >
                            <X size={ICON} />
                        </button>
                    </div>
                    <p className="text-sm text-red-800">{t("pay.daysPendingSub")}</p>
                </div>
            )}

            <div className="bg-white p-4 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800">
                        {weeks(slip.start, slip.end, t("pay.week"))}
                    </h3>
                    <Badge>
                        {t(
                            slip.status === "pending"
                                ? "pay.ongoing"
                                : slip.status === "paid"
                                  ? "pay.paid"
                                  : "pay.skipped",
                        )}
                    </Badge>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    <div className="text-center">
                        <p className="text-xl font-bold text-orange-600">{slip.orders}</p>
                        <p className="text-sm text-gray-600">{t("pay.orders")}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-xl font-bold text-blue-600">{slip.cups}</p>
                        <p className="text-sm text-gray-600">{t("pay.cups")}</p>
                    </div>
                    <div className="text-center col-span-2 border-l-2 border-gray-300">
                        <p className="text-sm text-gray-600">{t("pay.totalPay")}</p>
                        <p className="text-xl font-bold text-green-600">
                            {formatMoney(slip.total)}
                        </p>
                    </div>
                </div>
            </div>

            <Group title={t("pay.paymentDetails")}>
                <div className="bg-white p-4 rounded-2xl space-y-2 text-sm">
                    {detail(t("pay.staff"), slip.name)}
                    {detail(t("pay.from"), payDate(slip.start, locale))}
                    {detail(t("pay.to"), payDate(slip.end, locale))}
                    {detail(
                        t("pay.perCupLabel"),
                        slip.ratePerCup > 0 ? formatMoney(slip.ratePerCup) : "—",
                    )}
                    {detail(t("pay.expectedPayout"), payDate(addDays(slip.end, 1), locale))}
                    <div className="flex justify-between items-center pt-1.5 border-t border-gray-100">
                        <span className="text-gray-900">{t("pay.payslipId")}</span>
                        <CopyButton
                            value={slip.id}
                            size={13}
                            className="flex items-center gap-1 active:opacity-70"
                        >
                            <span className="font-mono text-xs text-gray-900">
                                {slip.id.slice(0, 8)}…
                            </span>
                        </CopyButton>
                    </div>
                    {detail(
                        t("pay.paidOn"),
                        slip.paidAt
                            ? formatCalendarDay(localDate(slip.paidAt), locale, "full")
                            : "—",
                    )}
                    {detail(t("pay.paidBy"), slip.paidBy || "—")}
                    {(slip.paymentProofUrl || slip.notes) && (
                        <div className="pt-2.5 border-t border-gray-100 space-y-3">
                            {slip.paymentProofUrl && (
                                <div className="space-y-1.5">
                                    <SectionLabel inset={false}>{t("pay.receipt")}</SectionLabel>
                                    <button
                                        onClick={() => setShowProof(true)}
                                        className="block size-20 rounded-lg overflow-hidden bg-gray-100 active:opacity-80"
                                    >
                                        <img
                                            src={slip.paymentProofUrl}
                                            alt={t("pay.receipt")}
                                            className="size-full object-cover"
                                        />
                                    </button>
                                </div>
                            )}
                            {slip.notes && (
                                <div className="space-y-1.5">
                                    <SectionLabel inset={false}>
                                        {t("pay.noteForStaff")}
                                    </SectionLabel>
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap bg-slate-50 rounded-xl p-3">
                                        {slip.notes}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Group>

            <Group title={t("pay.workDays")}>
                <div className="bg-white rounded-2xl px-3 py-3 space-y-1.5">
                    <div className="grid grid-cols-7 gap-1.5 mb-1">
                        {WEEKDAYS.map((d) => (
                            <span
                                key={d}
                                className="text-xs font-semibold text-gray-900 text-center"
                            >
                                {t(`common.weekdays.${d}`)}
                            </span>
                        ))}
                    </div>
                    {Array.from({ length: Math.ceil(days.length / 7) }, (_, w) =>
                        days.slice(w * 7, w * 7 + 7),
                    ).map((week, wi) => (
                        <div key={wi} className="grid grid-cols-7 gap-1.5 items-center">
                            {week.map((d) => (
                                <div
                                    key={d}
                                    className={`size-9 mx-auto flex items-center justify-center rounded-lg text-sm font-medium ${worked.has(d) ? "bg-blue-500 text-white font-semibold" : "bg-gray-100 text-gray-900"}`}
                                >
                                    {Number(d.slice(8))}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </Group>

            <Group title={t("pay.dailyBreakdown")}>
                <div className="space-y-2">
                    {dates.map((d) => {
                        const cms = commissionsOn[d] ?? [];
                        const cls = claimsOn[d] ?? [];
                        const rows = [...cms, ...cls];
                        const approvedTotal = rows
                            .filter((r) => r.status === "approved")
                            .reduce((s, r) => s + r.amount, 0);
                        const pending = rows.filter((r) => r.status === "pending");
                        const pendingTotal = pending.reduce((s, r) => s + r.amount, 0);
                        const allDone = pending.length === 0;
                        return (
                            <div
                                key={d}
                                id={`day-${d}`}
                                className="bg-white rounded-xl overflow-hidden"
                            >
                                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <p className="text-base font-bold text-gray-900">
                                            {formatCalendarDay(d, locale, "short")}
                                        </p>
                                        <Badge>
                                            {t(allDone ? "pay.dayDone" : "pay.dayPending")}
                                        </Badge>
                                    </div>
                                    <p className="text-base font-bold text-gray-900">
                                        {formatMoney(approvedTotal)}
                                    </p>
                                </div>
                                {cms.map((c) => (
                                    <div
                                        key={c.id}
                                        className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-none"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">
                                                {c.storeName || "—"}
                                            </p>
                                            <p className="text-xs text-gray-600">
                                                {c.cups} {t("pay.cupsUnit")} ×{" "}
                                                {formatMoney(c.ratePerCup)} ={" "}
                                                <span
                                                    className={
                                                        c.status === "rejected"
                                                            ? "line-through text-red-400"
                                                            : ""
                                                    }
                                                >
                                                    {formatMoney(c.amount)}
                                                </span>
                                            </p>
                                        </div>
                                        {toggles(
                                            c,
                                            "commission",
                                            c.storeName || t("pay.commission"),
                                        )}
                                    </div>
                                ))}
                                {cls.map((c) => (
                                    <div
                                        key={c.id}
                                        className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-none"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">
                                                {c.type || t("pay.claim")}
                                            </p>
                                            <p
                                                className={`text-xs ${c.status === "rejected" ? "line-through text-red-400" : "text-gray-600"}`}
                                            >
                                                {formatMoney(c.amount)}
                                            </p>
                                        </div>
                                        {toggles(c, "claim", c.type || t("pay.claim"))}
                                    </div>
                                ))}
                                {/* With one left, its own buttons already are the day's. */}
                                {pending.length > 1 && slip.status === "pending" && canWrite && (
                                    <div className="flex gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
                                        {(["rejected", "approved"] as const).map((s) => (
                                            <button
                                                key={s}
                                                onClick={() =>
                                                    setConfirm({
                                                        kind: "day",
                                                        id: d,
                                                        status: s,
                                                        label: formatCalendarDay(
                                                            d,
                                                            locale,
                                                            "short",
                                                        ),
                                                        amount: pendingTotal,
                                                        count: pending.length,
                                                    })
                                                }
                                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold ${
                                                    s === "approved"
                                                        ? "text-green-700 bg-green-50 active:bg-green-100"
                                                        : "text-red-600 bg-red-50 active:bg-red-100"
                                                }`}
                                            >
                                                {s === "approved" ? (
                                                    <Check size={15} strokeWidth={2.5} />
                                                ) : (
                                                    <X size={15} strokeWidth={2.5} />
                                                )}
                                                {t(
                                                    s === "approved"
                                                        ? "pay.approveAll"
                                                        : "pay.rejectAll",
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Group>

            {slip.status === "pending" && slip.pending === 0 && canWrite && (
                <FooterSlot>
                    <div className="bg-white border-t border-gray-200 p-4">
                        {left > 0 ? (
                            <button
                                disabled
                                className={`w-full py-3.5 text-white font-bold rounded-xl opacity-40 ${isSkip ? "bg-gray-700" : "bg-green-600"}`}
                            >
                                {daysLeftText(t, left)}
                            </button>
                        ) : (
                            <Link
                                to={pathname.concat("/settle")}
                                className={`block text-center w-full py-3.5 text-white font-bold rounded-xl active:opacity-80 ${isSkip ? "bg-gray-700" : "bg-green-600"}`}
                            >
                                {t(isSkip ? "pay.skip" : "pay.pay")}
                            </Link>
                        )}
                    </div>
                </FooterSlot>
            )}

            <Dialog open={showProof} onClose={() => setShowProof(false)}>
                <img
                    src={slip.paymentProofUrl}
                    alt={t("pay.receipt")}
                    className="rounded-xl max-h-[80vh] w-auto object-contain"
                />
            </Dialog>

            {confirm && (
                <Drawer
                    onClose={() => setConfirm(null)}
                    dim="bg-black/40"
                    className="p-5 space-y-4"
                >
                    <div className="flex items-center justify-between">
                        <p className="text-lg font-bold text-gray-900">
                            {confirmTitle(t, confirm)}
                        </p>
                        <button onClick={() => setConfirm(null)} aria-label={t("common.close")}>
                            <X size={ICON} className="text-gray-900" />
                        </button>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-base font-medium text-gray-800">{confirm.label}</p>
                        <p className="text-2xl font-bold text-gray-900">
                            {formatMoney(confirm.amount)}
                        </p>
                    </div>
                    <ActionButton
                        action={decide}
                        onError={() => setConfirm(null)}
                        resetOnSuccess
                        busyLabel={t("pay.saving")}
                        className={`w-full py-3.5 font-bold rounded-xl text-white active:opacity-80 disabled:opacity-40 flex items-center justify-center gap-2 ${
                            confirm.status === "approved" ? "bg-green-600" : "bg-red-500"
                        }`}
                    >
                        {t(confirm.status === "approved" ? "pay.approve" : "pay.reject")}
                    </ActionButton>
                    <button
                        onClick={() => setConfirm(null)}
                        className="w-full py-3 text-gray-900 text-sm font-medium"
                    >
                        {t("common.cancel")}
                    </button>
                </Drawer>
            )}
        </div>
    );
}

function confirmTitle(t: ReturnType<typeof useT>, c: Confirm): string {
    if (c.kind === "day")
        return t(c.status === "approved" ? "pay.approveAllN" : "pay.rejectAllN").replace(
            "{n}",
            String(c.count ?? 0),
        );
    const kind = t(c.kind === "commission" ? "pay.commissionWord" : "pay.claimWord");
    return t(c.status === "approved" ? "pay.approveX" : "pay.rejectX").replace("{x}", kind);
}

function Group({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-2">
            <SectionLabel>{title}</SectionLabel>
            {children}
        </section>
    );
}

export type { Slip };
