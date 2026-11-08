import { useT } from "@tea-pos/i18n/react";
import { Info, ScrollText } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { currentVersion, useAppUpdate, useUpdateState } from "../frame/update/AppUpdate";
import { rowIcon, SettingsGroup, SettingsRow } from "../frame/Settings";
import { UpdateNow } from "../frame/update/UpdateNow";
import { useUpdateText } from "../frame/update/useUpdateText";
import { useSlug } from "../session/tenant";
import { LATEST, seen } from "../lib/whatsNew";

/**
 * The More tab, as the old apps: what the app puts `before`, then General, the app's own rows
 * first, then Patch Notes (What's new).
 * Account is the avatar's, not a row here.
 */
export function MoreScreen({ rows, before }: { rows?: ReactNode; before?: ReactNode }) {
    const t = useT();
    const slug = useSlug();
    const { peek } = useAppUpdate();
    const state = useUpdateState();
    const stateText = useUpdateText(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => peek(), []);
    if (!slug) return null;
    const unseen = LATEST !== "" && seen() !== LATEST;
    return (
        <div className="space-y-4">
            {before}
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
                    to={`/${slug}/app-info`}
                    icon={<Info {...rowIcon} />}
                    label={t("status.title")}
                    sublabel={[currentVersion(), stateText].filter(Boolean).join(" · ")}
                    below={state === "available" ? <UpdateNow /> : undefined}
                />
            </SettingsGroup>
        </div>
    );
}
