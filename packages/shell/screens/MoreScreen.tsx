import { useT } from "@tea-pos/i18n/react";
import { toast } from "@tea-pos/ui/toast";
import { Download, Info, ScrollText } from "lucide-react";
import type { ReactNode } from "react";

import { currentVersion, useAppUpdate } from "../frame/AppUpdate";
import { rowIcon, SettingsGroup, SettingsRow } from "../frame/Settings";
import { useSlug } from "../session/tenant";
import { LATEST, seen } from "../lib/whatsNew";

/**
 * The More tab, as the old apps: General, the app's own rows first, then Patch Notes (What's new).
 * Account is the avatar's, not a row here.
 */
export function MoreScreen({ rows }: { rows?: ReactNode }) {
    const t = useT();
    const slug = useSlug();
    const update = useAppUpdate();
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
            <SettingsGroup title={t("more.app")}>
                <SettingsRow
                    icon={<Download {...rowIcon} />}
                    label={t("more.updateApp")}
                    sublabel={currentVersion()}
                    onClick={() => {
                        void update.checkNow().then((result) => {
                            if (result === "latest") toast(t("more.updateLatest"));
                            if (result === "offline") toast(t("more.updateOffline"));
                        });
                    }}
                />
                <SettingsRow
                    to={`/${slug}/app-info`}
                    icon={<Info {...rowIcon} />}
                    label={t("status.title")}
                />
            </SettingsGroup>
        </div>
    );
}
