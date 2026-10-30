import { useT } from "@tea-pos/i18n/react";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { useSlug } from "@tea-pos/shell/tenant";
import { Callout } from "@tea-pos/ui/Callout";
import { CalendarClock } from "lucide-react";

/** Rare settings with wide effects, out of everyday screens' way. */
export function Advanced() {
    const t = useT();
    const slug = useSlug();
    return (
        <div className="space-y-4">
            <Callout>{t("pay.advancedNote")}</Callout>
            <SettingsGroup>
                <SettingsRow
                    to={`/${slug}/advanced/schedule`}
                    icon={<CalendarClock {...rowIcon} />}
                    label={t("pay.schedule")}
                />
            </SettingsGroup>
        </div>
    );
}
