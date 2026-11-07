import { formatCalendarDay, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { uploadPhoto } from "@tea-pos/api-client/files";
import { FormFooter } from "@tea-pos/shell/FormFooter";
import { useFlag, useSlug, useTenant } from "@tea-pos/shell/tenant";
import { Field } from "@tea-pos/ui/form/Field";
import { NumberInput } from "@tea-pos/ui/form/NumberInput";
import { PhotoInput } from "@tea-pos/ui/PhotoInput";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useOpenStore } from "./home";

/** Opening a store: today's first cash and its photo. */
export function OpenStore() {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const navigate = useNavigate();
    const store = useTenant()?.store;
    const open = useOpenStore();
    const skipPhotos = useFlag("ops-skip-manage-photos");
    const [balance, setBalance] = useState<number | null>(null);
    const [photoUrl, setPhotoUrl] = useState<string>();
    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 space-y-3">
                <Field label={t("manage.storeLabel")}>
                    <p className="font-semibold text-gray-800">{store?.name}</p>
                </Field>
                <Field label={t("manage.date")}>
                    <p className="font-semibold text-gray-800">
                        {formatCalendarDay(localDate(), locale, "full")}
                    </p>
                </Field>
            </div>
            <div className="bg-white rounded-xl p-4 space-y-4">
                <Field label={t("manage.openingBalanceLabel")} required>
                    <NumberInput currency value={balance} onChange={setBalance} />
                </Field>
                <Field label={t("manage.openingPhoto")} required={!skipPhotos}>
                    <PhotoInput
                        upload={async (photo, onProgress) => {
                            const { url } = await uploadPhoto(
                                { tenant: slug, purpose: "daily_photo", storeId: store?.id },
                                photo,
                                onProgress,
                            );
                            setPhotoUrl(url);
                        }}
                        onRemove={() => setPhotoUrl(undefined)}
                        failedLabel={t("manage.photoProcessFailed")}
                        retakeLabel={t("common.retake")}
                        removeLabel={t("common.remove")}
                        title={t("manage.openingPhoto")}
                    >
                        {t("manage.photoTapToAdd")}
                    </PhotoInput>
                </Field>
            </div>
            <FormFooter
                label={t("manage.openStore")}
                busyLabel={t("manage.opening")}
                disabled={balance === null || (!photoUrl && !skipPhotos)}
                onSubmit={async () => {
                    await open.mutateAsync({ openingBalance: balance ?? 0, photoUrl });
                    await navigate({ to: "/$tenant/pos", params: { tenant: slug }, replace: true });
                }}
            />
        </div>
    );
}
