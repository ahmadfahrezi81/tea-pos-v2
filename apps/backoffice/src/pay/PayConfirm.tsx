import { api } from "@tea-pos/api-client";
import { uploadPhoto } from "@tea-pos/api-client/files";
import { formatMoney, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { FormFooter } from "@tea-pos/shell/FormFooter";
import { Callout } from "@tea-pos/ui/Callout";
import { CopyButton } from "@tea-pos/ui/CopyButton";
import { Field } from "@tea-pos/ui/form/Field";
import { Textarea } from "@tea-pos/ui/form/Textarea";
import { PhotoInput } from "@tea-pos/ui/PhotoInput";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { dayMonth, daysLeft, daysLeftText } from "./dates";
import { usePayslip, usePayStaff, usePayWrite, useSlug } from "./pay";
import { Skeleton } from "@tea-pos/ui/Skeleton";

function Copyable({
    value,
    prefix,
    className = "text-base font-medium text-gray-900",
}: {
    value: string;
    prefix?: string;
    className?: string;
}) {
    return (
        <CopyButton
            value={value}
            className={`flex items-center gap-1.5 active:opacity-70 ${className}`}
        >
            {prefix}
            {value}
        </CopyButton>
    );
}

/**
 * Pays a payout (the amount and bank details to copy, the transfer screenshot, a note for the
 * staff member) or, with nothing owed, closes it as skipped; as the old backoffice.
 */
export function PayConfirm({ id }: { id: string }) {
    const t = useT();
    const locale = useLocale();
    const router = useRouter();
    const slug = useSlug();
    const pathname = useLocation({ select: (l) => l.pathname });
    const { data: slip } = usePayslip(id);
    const { data: staff } = usePayStaff();
    const [proof, setProof] = useState<string | null>(null);
    const [notes, setNotes] = useState("");
    // Our own settle in flight: the guard below must not read it as a stale tab.
    const [settlingHere, setSettlingHere] = useState(false);
    const settle = usePayWrite(
        (
            tenant: string,
            body: { status: "paid" | "skipped"; paymentProofUrl?: string; notes?: string },
            key: string,
        ) =>
            api
                .POST("/tenants/{tenant}/pay/payouts/{id}/settle", {
                    params: { path: { tenant, id } },
                    body,
                    headers: { "Idempotency-Key": key },
                })
                .then((r) => {
                    if (r.error) throw r.error;
                }),
    );
    if (!slip || !staff)
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} delay={i * 80} className="h-24 rounded-xl" />
                ))}
            </div>
        );

    const person = staff.staff.find((s) => s.id === slip.userId);
    const settled = slip.status !== "pending";
    if (settled && !settlingHere) {
        return (
            <div className="space-y-4">
                <div className="bg-white rounded-xl p-6 space-y-2 text-center">
                    <p className="text-lg font-bold text-gray-900">
                        {t(slip.status === "skipped" ? "pay.alreadyClosed" : "pay.alreadyPaid")}
                    </p>
                    <p className="text-sm text-gray-900">{t("pay.alreadySub")}</p>
                </div>
                <Link
                    to={pathname.replace(/\/settle$/, "")}
                    replace
                    className="block text-center w-full py-3.5 bg-brand text-white font-bold rounded-xl active:opacity-80"
                >
                    {t("pay.viewPayslip")}
                </Link>
            </div>
        );
    }
    // Nothing owed: nothing to transfer, so the period is closed instead (the old app's rule, on the screen).
    const isSkip = slip.total === 0;
    const left = daysLeft(slip.end, localDate());
    const locked = left > 0;
    const name = person?.name ?? slip.name;
    const row = (label: string, value: ReactNode) => (
        <div className="flex justify-between items-center">
            <span className="text-gray-900">{label}</span>
            {typeof value === "string" ? (
                <span className="font-medium text-gray-800">{value}</span>
            ) : (
                value
            )}
        </div>
    );
    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 space-y-1">
                <p className="text-xs text-gray-900 font-medium uppercase tracking-wide">
                    {t(isSkip ? "pay.amountOwed" : "pay.amountToPay")}
                </p>
                {isSkip ? (
                    <p className="text-3xl font-bold text-gray-900">{formatMoney(0)}</p>
                ) : (
                    <Copyable
                        value={slip.total.toLocaleString("id-ID")}
                        prefix="Rp "
                        className="text-3xl font-bold text-gray-900"
                    />
                )}
                <p className="text-sm text-gray-900">
                    {dayMonth(slip.start, locale)} – {dayMonth(slip.end, locale)}{" "}
                    {slip.end.slice(0, 4)}
                </p>
            </div>

            <div className="bg-white rounded-xl p-4 space-y-2 text-sm">
                {row(t("pay.staff"), name)}
                {isSkip ? (
                    <Callout>{t("pay.skipNote")}</Callout>
                ) : (
                    <>
                        {row(t("pay.bank"), person?.bank.name || "—")}
                        {row(
                            t("pay.accountNo"),
                            person?.bank.accountNumber ? (
                                <Copyable value={person.bank.accountNumber} />
                            ) : (
                                <span className="font-medium text-amber-600">
                                    {t("pay.notSet")}
                                </span>
                            ),
                        )}
                        {row(t("pay.accountName"), person?.bank.accountHolder || "—")}
                    </>
                )}
            </div>

            {!isSkip && (
                <div className="bg-white rounded-xl p-4">
                    <Field label={t("pay.transferScreenshot")} required>
                        <PhotoInput
                            screenshot
                            failedLabel={t("pay.uploadFailed")}
                            upload={async (photo, onProgress) => {
                                const done = await uploadPhoto(
                                    { tenant: slug, purpose: "payroll_proof" },
                                    photo,
                                    onProgress,
                                );
                                setProof(done.url);
                            }}
                        >
                            {t("pay.addScreenshot")}
                        </PhotoInput>
                    </Field>
                </div>
            )}

            <div className="bg-white rounded-xl p-4 space-y-2">
                <Field label={t("pay.noteForStaff")}>
                    <Textarea
                        value={notes}
                        onChange={setNotes}
                        maxLength={500}
                        rows={3}
                        placeholder={t(isSkip ? "pay.noteSkipHint" : "pay.notePayHint")}
                    />
                </Field>
                <Callout>
                    {t(isSkip ? "pay.noteShownSkip" : "pay.noteShownPay").replace("{name}", name)}
                </Callout>
            </div>

            {locked && (
                <Callout>
                    {t(isSkip ? "pay.lockedSkip" : "pay.lockedPay").replace("{n}", String(left))}
                </Callout>
            )}

            <FormFooter
                label={
                    locked
                        ? daysLeftText(t, left)
                        : t(isSkip ? "pay.markSkipped" : "pay.confirmPayment")
                }
                busyLabel={t(isSkip ? "pay.closing" : "pay.confirming")}
                disabled={locked || (!isSkip && !proof)}
                tone={isSkip ? "gray" : "green"}
                emoji={isSkip ? "receipt" : "moneyWithWings"}
                confirmTitle={t(isSkip ? "pay.confirmSkip" : "pay.confirmPay")}
                confirmMessage={
                    isSkip
                        ? t("pay.confirmSkipSub").replace("{name}", name)
                        : `${formatMoney(slip.total)} → ${name}`
                }
                note={{
                    title: t("pay.recordsTitle"),
                    body: t(isSkip ? "pay.recordsSkip" : "pay.recordsPay"),
                }}
                onSubmit={async () => {
                    setSettlingHere(true);
                    try {
                        await settle.mutateAsync({
                            status: isSkip ? "skipped" : "paid",
                            ...(proof ? { paymentProofUrl: proof } : {}),
                            ...(notes.trim() ? { notes: notes.trim() } : {}),
                        });
                    } catch (err) {
                        setSettlingHere(false);
                        throw err;
                    }
                    // Back to the payslip behind: this screen must leave history either way.
                    router.history.back();
                }}
            />
        </div>
    );
}
