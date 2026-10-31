import type { components } from "@tea-pos/api-client";
import { formatMoney } from "@tea-pos/format";
import { useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import { FormFooter } from "@tea-pos/shell/FormFooter";
import { useAccess, useSlug } from "@tea-pos/shell/tenant";
import { InfoList, InfoRow } from "@tea-pos/ui/DetailList";
import { SearchBox as UiSearchBox } from "@tea-pos/ui/SearchBox";
import { Link, useRouter } from "@tanstack/react-router";
import { Check, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useCommissionTypes, usePayStaff, usePayWrite, writes } from "./pay";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { ICON } from "@tea-pos/ui/icon";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";

type Staff = components["schemas"]["PayStaff"];

/** The search box above a staff list, as the old app's. */
export function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const t = useT();
    return (
        <UiSearchBox
            value={value}
            onChange={onChange}
            placeholder={t("pay.searchStaff")}
            clearLabel={t("common.close")}
        />
    );
}

function Person({ s }: { s: Staff }) {
    return (
        <div className="bg-white rounded-xl p-4 flex items-center gap-4">
            <Avatar url={s.avatarUrl} size={56} />
            <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-lg font-semibold text-gray-900 truncate">{s.name}</p>
                <p className="text-sm text-gray-900 truncate">{s.email}</p>
            </div>
        </div>
    );
}

const Heading = ({ children }: { children: ReactNode }) => (
    <SectionLabel inset={false}>{children}</SectionLabel>
);

function useStaffMember(id: string) {
    const { data } = usePayStaff();
    return { loaded: !!data, staff: data?.staff.find((s) => s.id === id) };
}

/** A person's pay on their page: their commission type (admins change it) and bank details. */
export function PersonPay({ id }: { id: string }) {
    const t = useT();
    const slug = useSlug();
    const { canWrite } = useAccess();
    const { loaded, staff } = useStaffMember(id);
    if (!loaded) return <Skeleton className="h-40 rounded-2xl" />;
    if (!staff) return null;
    const type = staff.commissionType;
    const bank = staff.bank;
    const commission = (
        <>
            <span className="min-w-0 truncate">
                {type
                    ? `${type.name} · ${t("pay.perCup").replace("{rate}", formatMoney(type.ratePerCup))}`
                    : t("pay.noCommission")}
            </span>
        </>
    );
    return (
        <section className="space-y-2">
            <SectionLabel>{t("nav.pay")}</SectionLabel>
            <InfoList>
                {canWrite ? (
                    <Link
                        to="/$tenant/uac/$userId/commission"
                        params={{ tenant: slug, userId: id }}
                        className="flex items-center justify-between gap-4 text-[15px] text-gray-900 active:opacity-70"
                    >
                        <span className="shrink-0">{t("pay.commissionType")}</span>
                        <span className="flex min-w-0 items-center gap-1 font-medium">
                            {commission}
                            <ChevronRight
                                size={18}
                                strokeWidth={2.5}
                                className="text-brand/90 shrink-0"
                            />
                        </span>
                    </Link>
                ) : (
                    <InfoRow label={t("pay.commissionType")}>{commission}</InfoRow>
                )}
                {bank.name || bank.accountNumber ? (
                    <>
                        {bank.name && <InfoRow label={t("pay.bank")}>{bank.name}</InfoRow>}
                        {bank.accountNumber && (
                            <InfoRow label={t("pay.accountNumber")}>
                                <span className="font-mono">{bank.accountNumber}</span>
                            </InfoRow>
                        )}
                        {bank.accountHolder && (
                            <InfoRow label={t("pay.accountHolder")}>{bank.accountHolder}</InfoRow>
                        )}
                    </>
                ) : (
                    <InfoRow label={t("pay.bankDetails")}>{t("pay.noBank")}</InfoRow>
                )}
            </InfoList>
        </section>
    );
}

/** Picks one person's commission type (an enabled one, or none). */
export function StaffCommission({ id }: { id: string }) {
    const t = useT();
    const router = useRouter();
    const { loaded, staff } = useStaffMember(id);
    const { data: types } = useCommissionTypes();
    // undefined: untouched (what is stored shows); null: a deliberate None.
    const [picked, setPicked] = useState<string | null | undefined>(undefined);
    const save = usePayWrite(writes.setStaffCommission);
    const { canWrite } = useAccess();
    if (!loaded || !types) return <Skeleton className="h-40 rounded-xl" />;
    if (!staff) return <p className="p-4 text-sm text-gray-900">{t("pay.staffNotFound")}</p>;
    const selected = picked !== undefined ? picked : (staff.commissionType?.id ?? null);
    const option = (key: string | null, title: string, sub: string, mono = false) => (
        <button
            key={key ?? "none"}
            onClick={() => setPicked(key)}
            className="w-full bg-white rounded-xl px-4 py-3 flex items-center justify-between active:bg-gray-50"
        >
            <div className="text-left">
                <p className="text-base font-medium text-gray-900">{title}</p>
                <p className={`text-sm text-gray-900 ${mono ? "font-mono" : ""}`}>{sub}</p>
            </div>
            {selected === key && <Check size={ICON} className="text-brand shrink-0" />}
        </button>
    );
    const enabled = types.types.filter((ty) => ty.enabled);
    return (
        <div className="space-y-4">
            <Person s={staff} />
            <div className="space-y-2">
                <Heading>{t("pay.commissionType")}</Heading>
                {option(null, t("pay.none"), t("pay.noCommission"))}
                {enabled.length === 0 ? (
                    <p className="text-sm text-gray-900 px-1">{t("pay.noCommissionTypes")}</p>
                ) : (
                    enabled.map((ty) =>
                        option(
                            ty.id,
                            ty.name,
                            t("pay.perCup").replace("{rate}", formatMoney(ty.ratePerCup)),
                            true,
                        ),
                    )
                )}
            </div>
            {canWrite && (
                <FormFooter
                    label={t("pay.saveChanges")}
                    busyLabel={t("pay.saving")}
                    confirmTitle={t("pay.confirmStaffCommission")}
                    confirmMessage={t("pay.confirmStaffCommissionSub")}
                    onSubmit={async () => {
                        await save.mutateAsync({ userId: id, commissionTypeId: selected });
                        router.history.back();
                    }}
                />
            )}
        </div>
    );
}
