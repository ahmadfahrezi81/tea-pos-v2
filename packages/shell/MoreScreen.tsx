import { useT } from "@tea-pos/i18n/react";
import { Sparkles, UserRound } from "lucide-react";

import { rowIcon, SettingsGroup, SettingsRow } from "./Settings";
import { useTenant } from "./tenant";
import { LATEST, seen } from "./whatsNew";

/** The More tab: what both apps share; each app adds its own entries later. */
export function MoreScreen() {
    const t = useT();
    const slug = useTenant()?.tenant.slug;
    if (!slug) return null;
    const unseen = LATEST !== "" && seen() !== LATEST;
    return (
        <div className="space-y-4">
            <SettingsGroup>
                <SettingsRow
                    to={`/${slug}/account`}
                    icon={<UserRound {...rowIcon} />}
                    label={t("more.account")}
                />
                <SettingsRow
                    to={`/${slug}/whats-new`}
                    icon={<Sparkles {...rowIcon} />}
                    label={t("more.whatsNew")}
                    dot={unseen}
                />
            </SettingsGroup>
        </div>
    );
}
