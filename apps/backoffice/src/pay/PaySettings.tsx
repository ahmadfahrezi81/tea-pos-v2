import { useT } from "@tea-pos/i18n/react";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { Coins, ReceiptText } from "lucide-react";
import { useSlug } from "@tea-pos/shell/tenant";

import { useClaimTypes, useCommissionTypes } from "./pay";

/** Pay settings: the rules for the whole business. A person's own pay lives on their page in People. */
export function PaySettings() {
    const t = useT();
    const base = `/${useSlug()}/pay/settings`;
    const commissions = useCommissionTypes().data?.types.length;
    const claims = useClaimTypes().data?.types.length;
    const count = (n: number | undefined) =>
        n === undefined ? undefined : t("pay.typesCount").replace("{n}", String(n));
    return (
        <SettingsGroup>
            <SettingsRow
                to={`${base}/commission-types`}
                icon={<Coins {...rowIcon} />}
                label={t("pay.commissionTypes")}
                sublabel={count(commissions)}
            />
            <SettingsRow
                to={`${base}/claim-types`}
                icon={<ReceiptText {...rowIcon} />}
                label={t("pay.claimTypes")}
                sublabel={count(claims)}
            />
        </SettingsGroup>
    );
}
