import { LoadFailed } from "@tea-pos/shell/LoadFailed";
import { formatMoney } from "@tea-pos/format";
import { useT } from "@tea-pos/i18n/react";
import { FormFooter } from "@tea-pos/shell/FormFooter";
import { HeaderActions } from "@tea-pos/shell/HeaderActions";
import { Field } from "@tea-pos/ui/form/Field";
import { NumberInput } from "@tea-pos/ui/form/NumberInput";
import { SelectInput } from "@tea-pos/ui/form/SelectInput";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { useRouter } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { useState } from "react";

import { useAddExpense, useGate, useStoreDay } from "./home";

/** Today's expenses and their total. */
export function Expenses() {
    const t = useT();
    const { data: gate } = useGate();
    const { data: day, error } = useStoreDay(gate?.dayId);
    return (
        <div className="flex-1 bg-white rounded-2xl flex flex-col min-h-full">
            <HeaderActions actions={[{ kind: "add", to: "add", own: true }]} />
            {error && !day ? (
                <LoadFailed error={error} />
            ) : !day ? (
                <Skeleton className="h-40 rounded-2xl" />
            ) : day.expenseItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
                    <Receipt size={40} className="text-gray-300 mb-3" />
                    <p className="text-gray-500 text-sm">{t("manage.noExpenses")}</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {day.expenseItems.map((e) => (
                        <div key={e.id} className="flex justify-between px-4 py-3">
                            <span className="text-base text-gray-700">{e.type}</span>
                            <span className="text-base font-medium text-gray-900">
                                {formatMoney(e.amount)}
                            </span>
                        </div>
                    ))}
                    <div className="flex justify-between px-4 py-3">
                        <span className="text-base font-semibold text-gray-700">
                            {t("manage.total")}
                        </span>
                        <span className="text-base font-semibold text-gray-900">
                            {formatMoney(day.expenses)}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

const CUSTOM = "Custom";

/** One expense. The type is saved as v1 saves it: Ice, Electricity, or the seller's own words. */
export function AddExpense() {
    const t = useT();
    const router = useRouter();
    const { data: gate } = useGate();
    const add = useAddExpense();
    const [type, setType] = useState("Ice");
    const [custom, setCustom] = useState("");
    const [amount, setAmount] = useState<number | null>(null);
    const own = type === CUSTOM ? custom.trim() : type;
    return (
        <div className="space-y-3">
            <div className="bg-white rounded-xl p-4 space-y-4">
                <Field label={t("manage.type")}>
                    <SelectInput
                        options={[
                            { value: "Ice", label: t("manage.expenseTypes.ice") },
                            { value: "Electricity", label: t("manage.expenseTypes.electricity") },
                            { value: CUSTOM, label: t("manage.expenseTypes.custom") },
                        ]}
                        value={type}
                        onChange={(v) => {
                            setType(v);
                            setCustom("");
                        }}
                        otherTriggerValue={CUSTOM}
                        otherValue={custom}
                        onOtherChange={setCustom}
                        otherPlaceholder={t("manage.expenseCustomPlaceholder")}
                    />
                </Field>
                <Field label={t("manage.amount")} required>
                    <NumberInput currency value={amount} onChange={setAmount} />
                </Field>
            </div>
            <FormFooter
                label={t("manage.submitExpense")}
                disabled={!gate?.dayId || !amount || !own}
                onSubmit={async () => {
                    await add.mutateAsync({
                        dayId: gate?.dayId ?? "",
                        type: own,
                        amount: amount ?? 0,
                    });
                    router.history.back();
                }}
            />
        </div>
    );
}
