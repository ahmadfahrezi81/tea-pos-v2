import { useT } from "@tea-pos/i18n/react";
import { ScrollText, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { rowIcon, SettingsGroup, SettingsRow } from "./Settings";
import { useTenant } from "./tenant";
import { LATEST, seen } from "./whatsNew";

/**
 * The More tab, as the old apps: General (the app's own rows first, then What's new, the old
 * Patch Notes), and the account.
 */
export function MoreScreen({ rows }: { rows?: ReactNode }) {
    const t = useT();
    const slug = useTenant()?.tenant.slug;
    if (!slug) return null;
    const unseen = LATEST !== "" && seen() !== LATEST;
    return (
        <div className="space-y-4">
            <SettingsGroup title={t("more.general")}>
                {rows}
                <SettingsRow
                    to={`/${slug}/whats-new`}
                    icon={<ScrollText {...rowIcon} />}
                    label={t("more.whatsNew")}
                    dot={unseen}
                />
            </SettingsGroup>
            <SettingsGroup>
                <SettingsRow
                    to={`/${slug}/account`}
                    icon={<UserRound {...rowIcon} />}
                    label={t("more.account")}
                />
            </SettingsGroup>
        </div>
    );
}
