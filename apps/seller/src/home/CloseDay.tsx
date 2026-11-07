import { LoadFailed } from "@tea-pos/shell/LoadFailed";
import { uploadPhoto } from "@tea-pos/api-client/files";
import { formatMoney } from "@tea-pos/format";
import { useT } from "@tea-pos/i18n/react";
import { DayView } from "@tea-pos/shell/DayView";
import { FooterSlot } from "@tea-pos/shell/FooterSlotContext";
import { useFlag, useSlug } from "@tea-pos/shell/tenant";
import { ActionButton } from "@tea-pos/ui/ActionButton";
import { Field } from "@tea-pos/ui/form/Field";
import { NumberInput } from "@tea-pos/ui/form/NumberInput";
import { PhotoInput } from "@tea-pos/ui/PhotoInput";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { toast } from "@tea-pos/ui/toast";
import type { MessageKey } from "@tea-pos/i18n";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
    useCloseDay,
    useGate,
    useSaveDayPhoto,
    useStoreDay,
    useStoreId,
    type PhotoSlot,
} from "./home";

const SLOTS: {
    type: PhotoSlot;
    step: MessageKey;
    label: MessageKey;
    about: MessageKey;
    unit?: string;
}[] = [
    {
        type: "closing:ice",
        step: "manage.closeSteps.ice",
        label: "manage.photoLabels.iceBin",
        about: "manage.photoDescriptions.ice",
    },
    {
        type: "closing:syrup",
        step: "manage.closeSteps.syrup",
        label: "manage.photoLabels.syrup",
        about: "manage.photoDescriptions.syrup",
    },
    {
        type: "closing:bags",
        step: "manage.closeSteps.bags",
        label: "manage.photoLabels.bags",
        about: "manage.photoDescriptions.bags",
    },
    {
        type: "closing:cups",
        step: "manage.closeSteps.cups",
        label: "manage.photoLabels.cups",
        about: "manage.photoDescriptions.cups",
        unit: "pcs",
    },
    {
        type: "closing:tea",
        step: "manage.closeSteps.waste",
        label: "manage.photoLabels.teaWaste",
        about: "manage.photoDescriptions.tea",
        unit: "L",
    },
];
const REVIEW = SLOTS.length;

// The step survives a reload; a phone that cannot keep it starts over, with its photos saved.
const readStep = (key: string) => {
    try {
        return Math.min(Number(localStorage.getItem(key)) || 0, REVIEW);
    } catch {
        return 0;
    }
};
const writeStep = (key: string, step: number | null) => {
    try {
        if (step === null) localStorage.removeItem(key);
        else localStorage.setItem(key, String(step));
    } catch {
        // Only a convenience.
    }
};

/** Closing today, or an `oldDay` left open: a photo per step (a count on cups and tea), then the review and the cash. */
export function CloseDay({ oldDay }: { oldDay?: string }) {
    const t = useT();
    const slug = useSlug();
    const storeId = useStoreId();
    const navigate = useNavigate();
    const skipPhotos = useFlag("ops-skip-manage-photos");
    const { data: gate } = useGate();
    const dayId = oldDay ?? (gate?.gate === "open" ? gate.dayId : undefined);
    const { data: day, error, refetch } = useStoreDay(dayId);
    const savePhoto = useSaveDayPhoto();
    const close = useCloseDay();
    const key = `close-day-step-${dayId}`;
    const [step, setStep] = useState(0);
    const restored = useRef(false);
    const [taken, setTaken] = useState<Partial<Record<PhotoSlot, string>>>({});
    const [counts, setCounts] = useState<Partial<Record<PhotoSlot, number | null>>>({});
    const [cash, setCash] = useState<number | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const confirmRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!dayId || restored.current) return;
        restored.current = true;
        setStep(readStep(key));
    }, [dayId, key]);

    const go = (next: number) => {
        setStep(next);
        writeStep(key, next);
    };

    if ((gate && !dayId) || day?.closedAt)
        return (
            <p className="bg-white rounded-2xl p-6 text-center text-sm text-gray-500">
                {t("manage.noOpenSummary")}
            </p>
        );
    if (error && !day) return <LoadFailed error={error} />;
    if (!day) return <Skeleton className="h-64 rounded-2xl" />;

    const slot = step < REVIEW ? SLOTS[step] : undefined;
    const saved = slot && day.photos.find((p) => p.type === slot.type);
    const count =
        slot && (slot.type in counts ? counts[slot.type] : (saved?.quantity?.value ?? null));
    const ready =
        !slot ||
        skipPhotos ||
        (!!(taken[slot.type] || saved) && (!slot.unit || (count ?? null) !== null));
    const expected = day.expectedCash;
    const actual = cash ?? expected;

    const next = async () => {
        if (slot) {
            const url = taken[slot.type];
            const changed = slot.type in counts;
            if (url || (saved && changed)) {
                await savePhoto.mutateAsync({
                    dayId: day.id,
                    type: slot.type,
                    url,
                    quantity:
                        slot.unit && count != null ? { value: count, unit: slot.unit } : undefined,
                });
                setTaken((p) => ({ ...p, [slot.type]: undefined }));
                setCounts((c) => {
                    const rest = { ...c };
                    delete rest[slot.type];
                    return rest;
                });
            }
        }
        if (step === REVIEW - 1) await refetch();
        go(step + 1);
    };

    return (
        <div className="flex flex-col">
            <FooterSlot>
                <div className="bg-white border-t border-gray-200 p-4 flex gap-3">
                    {step > 0 && (
                        <button
                            onClick={() => {
                                setConfirmed(false);
                                go(step - 1);
                            }}
                            className="px-5 py-4 rounded-xl bg-gray-100 text-gray-900 font-semibold text-base active:scale-[0.98] transition-transform"
                        >
                            {t("manage.previous")}
                        </button>
                    )}
                    {slot ? (
                        <ActionButton
                            key="next"
                            action={next}
                            onError={() => {}}
                            resetOnSuccess
                            busyLabel={t("manage.uploading")}
                            disabled={!ready}
                            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-brand text-white font-semibold text-base active:scale-[0.98] transition-transform disabled:opacity-50"
                        >
                            {t("manage.next")}
                        </ActionButton>
                    ) : !confirmed ? (
                        // The summary is long: first take the seller down to the box they must tick.
                        <button
                            key="review"
                            onClick={() =>
                                confirmRef.current?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "center",
                                })
                            }
                            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-brand text-white font-semibold text-base active:scale-[0.98] transition-transform"
                        >
                            {t("manage.review")}
                            <ArrowDown size={18} strokeWidth={2.5} />
                        </button>
                    ) : (
                        <ActionButton
                            key="close"
                            action={async () => {
                                await close.mutateAsync({ dayId: day.id, actualCash: actual });
                                writeStep(key, null);
                                toast(t("manage.dayClosed"), { kind: "success" });
                                await navigate({
                                    to: oldDay ? "/$tenant/analytics" : "/$tenant/manage",
                                    params: { tenant: slug },
                                    replace: true,
                                });
                            }}
                            onError={() => {}}
                            busyLabel={t("manage.closing")}
                            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-red-500 text-white font-semibold text-base active:scale-[0.98] transition-transform disabled:opacity-50"
                        >
                            {t("manage.closeDay")}
                        </ActionButton>
                    )}
                </div>
            </FooterSlot>

            <Steps current={step} onPick={go} />

            <div className="pt-2">
                {slot ? (
                    <div className="flex flex-col gap-3">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">{t(slot.label)}</h2>
                            <p className="text-sm text-gray-600 mt-0.5">{t(slot.about)}</p>
                        </div>
                        <div className="p-3 bg-white flex flex-col gap-4 rounded-2xl border border-gray-50">
                            {slot.unit && (
                                <Field label={t("manage.quantityLabel")} required={!skipPhotos}>
                                    <NumberInput
                                        value={count ?? null}
                                        unit={slot.unit}
                                        onChange={(v) =>
                                            setCounts((c) => ({ ...c, [slot.type]: v }))
                                        }
                                    />
                                </Field>
                            )}
                            <Field label={t("manage.attachmentLabel")} required={!skipPhotos}>
                                <PhotoInput
                                    key={slot.type}
                                    preview={saved?.url || undefined}
                                    upload={async (photo, onProgress) => {
                                        const { url } = await uploadPhoto(
                                            { tenant: slug, purpose: "daily_photo", storeId },
                                            photo,
                                            onProgress,
                                        );
                                        setTaken((p) => ({ ...p, [slot.type]: url }));
                                    }}
                                    failedLabel={t("manage.photoProcessFailed")}
                                >
                                    {t("manage.photoTapToAdd")}
                                </PhotoInput>
                            </Field>
                        </div>
                    </div>
                ) : (
                    <DayView
                        day={{ ...day, actualCash: actual, variance: actual - expected }}
                        counting={
                            <div className="bg-white rounded-2xl p-3 space-y-3">
                                <Field label={t("manage.cashStep.actualCash")} required>
                                    <NumberInput
                                        currency
                                        value={actual}
                                        onChange={(v) => setCash(v ?? 0)}
                                    />
                                    <p className="text-sm text-gray-600">
                                        {t("manage.cashStep.expected")} {formatMoney(expected)}
                                    </p>
                                </Field>
                                <div
                                    className={`p-2 rounded-lg ${actual >= expected ? "bg-green-50" : "bg-red-50"}`}
                                >
                                    <p className="text-xs font-semibold text-gray-700">
                                        {t("manage.cashStep.variance")}
                                    </p>
                                    <p
                                        className={`text-xl font-bold ${actual >= expected ? "text-green-600" : "text-red-600"}`}
                                    >
                                        {actual >= expected ? "+" : ""}
                                        {formatMoney(actual - expected)}
                                    </p>
                                </div>
                            </div>
                        }
                    >
                        <button
                            ref={confirmRef}
                            onClick={() => setConfirmed((v) => !v)}
                            className="flex items-center gap-3 p-4 rounded-2xl w-full text-left bg-white"
                        >
                            <span
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${confirmed ? "bg-brand border-brand" : "border-gray-300"}`}
                            >
                                {confirmed && <Check size={14} className="text-white" />}
                            </span>
                            <span className="text-xs font-semibold text-gray-700">
                                {t("manage.confirmSummary")}
                            </span>
                        </button>
                    </DayView>
                )}
            </div>
        </div>
    );
}

/** The steps along the top; a finished one can be gone back to. */
function Steps({ current, onPick }: { current: number; onPick: (step: number) => void }) {
    const t = useT();
    const labels: MessageKey[] = [...SLOTS.map((s) => s.step), "manage.closeSteps.review"];
    return (
        <div className="w-full pb-3 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center min-w-max">
                {labels.map((label, i) => {
                    const done = i < current;
                    const here = i === current;
                    return (
                        <div key={label} className="flex items-center">
                            <div className="flex flex-col items-center gap-0.5">
                                <button
                                    onClick={() => done && onPick(i)}
                                    disabled={!done}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${done ? "bg-brand text-white active:scale-95" : here ? "bg-brand/10 text-brand border-2 border-brand" : "bg-gray-300 text-gray-500"}`}
                                >
                                    {done ? <Check size={18} /> : i + 1}
                                </button>
                                <p
                                    className={`text-xs font-medium whitespace-nowrap ${here ? "text-brand" : done ? "text-brand/80" : "text-gray-500"}`}
                                >
                                    {t(label)}
                                </p>
                            </div>
                            {i < labels.length - 1 && (
                                <div
                                    className={`w-5 h-0.5 mx-1.5 mb-4 shrink-0 transition-colors ${done ? "bg-brand" : "bg-gray-300"}`}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
