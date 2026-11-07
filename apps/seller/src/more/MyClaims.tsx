import { LoadFailed } from "@tea-pos/shell/LoadFailed";
import { uploadPhoto } from "@tea-pos/api-client/files";
import { addDays, formatCalendarDay, formatMoney, localDate } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { FormFooter } from "@tea-pos/shell/FormFooter";
import { HeaderActions } from "@tea-pos/shell/HeaderActions";
import { useSlug, useTenant } from "@tea-pos/shell/tenant";
import { Field } from "@tea-pos/ui/form/Field";
import { ReadOnlyInput } from "@tea-pos/ui/form/ReadOnlyInput";
import { SelectInput } from "@tea-pos/ui/form/SelectInput";
import { Textarea } from "@tea-pos/ui/form/Textarea";
import { PhotoInput } from "@tea-pos/ui/PhotoInput";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { useRouter } from "@tanstack/react-router";
import { CalendarDays, ReceiptText } from "lucide-react";
import { useState } from "react";

import { useCreateClaim, useMyClaims, useMyClaimTypes } from "./mine";

const STATUS: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-600",
};
const STATUS_WORD = {
    pending: "claims.statusPending",
    approved: "claims.statusApproved",
    rejected: "claims.statusRejected",
} as const satisfies Record<string, MessageKey>;
const FREQUENCY = {
    daily: "claims.freqDaily",
    weekly: "claims.freqWeekly",
    monthly: "claims.freqMonthly",
    one_time: "claims.freqOneTime",
} as const satisfies Record<string, MessageKey>;
const SOURCE = {
    manual: "claims.sourceManual",
    auto: "claims.auto",
    auto_submit: "claims.sourceAutoSubmit",
} as const satisfies Record<string, MessageKey>;

const lastOfMonth = (month: string) => {
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    return addDays(
        `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`,
        -1,
    );
};

/** My Claims: what the seller is entitled to, and their claims month by month. */
export function MyClaims() {
    const t = useT();
    const locale = useLocale();
    const [month, setMonth] = useState(localDate().slice(0, 7));
    const { data: entitled } = useMyClaimTypes();
    const { data: claims, error } = useMyClaims(`${month}-01`, lastOfMonth(month));
    return (
        <div className="space-y-3">
            <HeaderActions actions={[{ kind: "add", to: "add", own: true }]} />
            <div className="bg-white rounded-2xl p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-800">{t("claims.entitlements")}</p>
                {!entitled ? (
                    <Skeleton className="h-12 rounded-xl" />
                ) : entitled.types.length === 0 ? (
                    <div className="py-1 space-y-0.5">
                        <p className="text-sm font-medium text-gray-700">
                            {t("claims.noEntitlementsYet")}
                        </p>
                        <p className="text-xs text-gray-500">{t("claims.noEntitlementsHint")}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {entitled.types.map((type) => (
                            <div key={type.id} className="flex items-center justify-between py-2.5">
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{type.name}</p>
                                    <p className="text-xs text-gray-600 font-medium">
                                        {t(FREQUENCY[type.frequency])} · {t(SOURCE[type.source])}
                                    </p>
                                </div>
                                <p className="text-base font-bold text-gray-900">
                                    {formatMoney(type.amount)}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-white p-4 rounded-2xl">
                <label className="block text-sm font-medium text-gray-700">
                    <CalendarDays size={16} className="inline mr-1" />
                    {t("analytics.selectMonth")}
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value || localDate().slice(0, 7))}
                        className="mt-2 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/90 focus:outline-none"
                    />
                </label>
            </div>

            <div className="bg-white rounded-2xl">
                {error && !claims ? (
                    <LoadFailed error={error} />
                ) : !claims ? (
                    <Skeleton className="h-24 rounded-2xl" />
                ) : claims.claims.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-12">
                        <ReceiptText size={40} className="text-gray-300 mb-3" />
                        <p className="text-gray-500 text-sm">{t("claims.noClaims")}</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {claims.claims.map((claim) => (
                            <li
                                key={claim.id}
                                className="flex items-center justify-between px-4 py-3"
                            >
                                <div>
                                    <p className="text-base font-medium text-gray-800">
                                        {claim.type || "—"}
                                    </p>
                                    <p className="text-sm text-gray-400">
                                        {formatCalendarDay(claim.date, locale, "short")}
                                    </p>
                                </div>
                                <div className="text-right flex flex-col items-end gap-1">
                                    <p className="text-base font-semibold text-gray-900">
                                        {formatMoney(claim.amount)}
                                    </p>
                                    <span
                                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS[claim.status]}`}
                                    >
                                        {t(STATUS_WORD[claim.status])}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

/** One claim by hand: its amount is the type's, its date today, or a worked day if it is weekly. */
export function AddClaim() {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const router = useRouter();
    const storeId = useTenant()?.store?.id;
    const { data } = useMyClaimTypes();
    const create = useCreateClaim();
    const [typeId, setTypeId] = useState("");
    const [picked, setPicked] = useState("");
    const [notes, setNotes] = useState("");
    const [photoUrl, setPhotoUrl] = useState<string>();
    const today = localDate();
    const types = data?.types ?? [];
    const dates = data?.workDates ?? [];
    const options = types
        .filter((x) => x.claimable && x.source === "manual")
        .map((x) => ({ value: x.id, label: x.name }));
    const type = types.find((x) => x.id === typeId);
    const weekly = type?.frequency === "weekly";
    const date = !weekly
        ? today
        : dates.includes(picked)
          ? picked
          : dates.includes(today)
            ? today
            : (dates[dates.length - 1] ?? "");
    const ready = !!type && type.amount > 0 && !!date;
    return (
        <div className="space-y-3">
            <div className="bg-white rounded-xl p-4 space-y-4">
                <Field label={t("claims.typeLabel")} required>
                    {!data ? (
                        <Skeleton className="h-12 rounded-xl" />
                    ) : types.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">
                            {t("claims.noClaimEntitlements")}
                        </p>
                    ) : options.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">{t("claims.allSubmitted")}</p>
                    ) : (
                        <SelectInput
                            options={options}
                            value={typeId}
                            onChange={setTypeId}
                            placeholder={t("claims.selectType")}
                        />
                    )}
                </Field>
                {type && (
                    <>
                        <Field label={t("claims.amountLabel")} required>
                            <ReadOnlyInput value={formatMoney(type.amount)} />
                        </Field>
                        <Field label={t("claims.dateLabel")} required>
                            {!weekly ? (
                                <ReadOnlyInput value={formatCalendarDay(today, locale, "full")} />
                            ) : dates.length === 0 ? (
                                <p className="text-sm text-gray-400 py-2">
                                    {t("claims.noWorkedDates")}
                                </p>
                            ) : (
                                <SelectInput
                                    options={dates.map((d) => ({
                                        value: d,
                                        label: formatCalendarDay(d, locale, "full"),
                                    }))}
                                    value={date}
                                    onChange={setPicked}
                                />
                            )}
                        </Field>
                        <Field label={t("claims.receiptPhoto")}>
                            <PhotoInput
                                screenshot
                                upload={async (photo, onProgress) => {
                                    const { url } = await uploadPhoto(
                                        { tenant: slug, purpose: "reimbursement" },
                                        photo,
                                        onProgress,
                                    );
                                    setPhotoUrl(url);
                                }}
                                onRemove={() => setPhotoUrl(undefined)}
                                failedLabel={t("manage.photoProcessFailed")}
                                retakeLabel={t("common.retake")}
                                removeLabel={t("common.remove")}
                                title={t("claims.receiptPhoto")}
                            >
                                {t("manage.photoTapToAdd")}
                            </PhotoInput>
                        </Field>
                        <Field label={t("claims.notesLabel")}>
                            <Textarea
                                value={notes}
                                onChange={setNotes}
                                placeholder={t("claims.notesPlaceholder")}
                                rows={3}
                                maxLength={500}
                            />
                        </Field>
                    </>
                )}
            </div>
            <FormFooter
                label={t("claims.submitClaim")}
                busyLabel={t("claims.submitting")}
                disabled={!ready}
                onSubmit={async () => {
                    await create.mutateAsync({
                        typeId,
                        date,
                        storeId,
                        notes: notes.trim() || undefined,
                        photoUrl,
                    });
                    router.history.back();
                }}
            />
        </div>
    );
}
