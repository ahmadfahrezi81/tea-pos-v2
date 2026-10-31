import { formatCalendarDay, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { FormFooter } from "@tea-pos/shell/FormFooter";
import { useSlug, useTenant } from "@tea-pos/shell/tenant";
import { Field } from "@tea-pos/ui/form/Field";
import { NumberInput } from "@tea-pos/ui/form/NumberInput";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useOpenStore } from "./home";

/** Opening a store: today's first cash. The opening photo joins with the day's photos. */
export function OpenStore() {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const navigate = useNavigate();
    const store = useTenant()?.store;
    const open = useOpenStore();
    const [balance, setBalance] = useState<number | null>(null);
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
            </div>
            <FormFooter
                label={t("manage.openStore")}
                busyLabel={t("manage.opening")}
                disabled={balance === null}
                onSubmit={async () => {
                    await open.mutateAsync({ openingBalance: balance ?? 0 });
                    await navigate({ to: "/$tenant/pos", params: { tenant: slug }, replace: true });
                }}
            />
        </div>
    );
}
