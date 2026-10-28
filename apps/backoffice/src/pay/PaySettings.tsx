import { useT } from "@tea-pos/i18n/react";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { CalendarClock, Coins, IdCard, Percent, ReceiptText } from "lucide-react";

import { useSlug } from "./pay";

/** ⚙ Pay settings: the setup, in three short groups, out of the Pay home's way. */
export function PaySettings() {
    const t = useT();
    const base = `/${useSlug()}/pay/settings`;
    return (
        <div className="space-y-4">
            <SettingsGroup title={t("pay.groupPeople")}>
                <SettingsRow
                    to={`${base}/staff`}
                    icon={<IdCard {...rowIcon} />}
                    label={t("pay.staffInfo")}
                />
                <SettingsRow
                    to={`${base}/staff-commissions`}
                    icon={<Percent {...rowIcon} />}
                    label={t("pay.staffCommissions")}
                />
            </SettingsGroup>
            <SettingsGroup title={t("pay.groupTypes")}>
                <SettingsRow
                    to={`${base}/commission-types`}
                    icon={<Coins {...rowIcon} />}
                    label={t("pay.commissionTypes")}
                />
                <SettingsRow
                    to={`${base}/claim-types`}
                    icon={<ReceiptText {...rowIcon} />}
                    label={t("pay.claimTypes")}
                />
            </SettingsGroup>
            <SettingsGroup title={t("pay.groupSchedule")}>
                <SettingsRow
                    to={`${base}/schedule`}
                    icon={<CalendarClock {...rowIcon} />}
                    label={t("pay.schedule")}
                />
            </SettingsGroup>
        </div>
    );
}
