import { useT } from "@tea-pos/i18n/react";
import { InfoList, InfoRow } from "@tea-pos/ui/DetailList";
import { SearchBox as UiSearchBox } from "@tea-pos/ui/SearchBox";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";
import { Skeleton } from "@tea-pos/ui/Skeleton";

import { usePayStaff } from "./pay";
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

function useStaffMember(id: string) {
    const { data } = usePayStaff();
    return { loaded: !!data, staff: data?.staff.find((s) => s.id === id) };
}

/** A person's bank details on their page: they set them themselves, so read only. */
export function PersonBank({ id }: { id: string }) {
    const t = useT();
    const { loaded, staff } = useStaffMember(id);
    if (!loaded) return <Skeleton className="h-24 rounded-2xl" />;
    if (!staff) return null;
    const bank = staff.bank;
    return (
        <section className="space-y-2">
            <SectionLabel>{t("pay.bankDetails")}</SectionLabel>
            <InfoList>
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
