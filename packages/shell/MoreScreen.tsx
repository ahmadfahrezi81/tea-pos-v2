import { useT } from "@tea-pos/i18n/react";
import { ScrollText } from "lucide-react";
import type { ReactNode } from "react";

import { rowIcon, SettingsGroup, SettingsRow } from "./Settings";
import { useTenant } from "./tenant";
import { LATEST, seen } from "./whatsNew";

/**
 * The More tab, as the old apps: General, the app's own rows first, then Patch Notes (What's new).
 * Account is the avatar's, not a row here.
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
                    label={t("more.patchNotes")}
                    dot={unseen}
                />
            </SettingsGroup>
        </div>
    );
}
