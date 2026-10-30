import { useT } from "@tea-pos/i18n/react";
import { toast } from "@tea-pos/ui/toast";
import { Download, ScrollText } from "lucide-react";
import { useState, type ReactNode } from "react";

import { currentVersion, forceUpdate } from "../frame/AppUpdate";
import { ConfirmSheet } from "../frame/FormFooter";
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
    const [updating, setUpdating] = useState(false);
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
                <SettingsRow
                    icon={<Download {...rowIcon} />}
                    label={t("more.updateApp")}
                    sublabel={currentVersion()}
                    onClick={() => setUpdating(true)}
                />
            </SettingsGroup>
            <ConfirmSheet
                open={updating}
                title={t("more.updateTitle")}
                message={t("more.updateBody")}
                emoji="sparkles"
                label={t("more.updateApp")}
                onCancel={() => setUpdating(false)}
                onConfirm={async () => {
                    if (await forceUpdate()) return;
                    setUpdating(false);
                    toast(t("more.updateOffline"));
                }}
            />
        </div>
    );
}
