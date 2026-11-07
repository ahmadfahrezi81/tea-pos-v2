import { useT } from "@tea-pos/i18n/react";
import { toast } from "@tea-pos/ui/toast";
import { Check, Download, Info, ScrollText } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { buildLabel, currentVersion, useAppUpdate } from "../frame/AppUpdate";
import { APP_TAG } from "@tea-pos/api-client/status";
import { rowIcon, SettingsGroup, SettingsRow } from "../frame/Settings";
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
    const update = useAppUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => update.peek(), []);
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
                    icon={<Download {...rowIcon} />}
                    label={t("more.updateApp")}
                    sublabel={<UpdateStatus />}
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

/** This build, then where it stands against the one the server has. */
function UpdateStatus() {
    const t = useT();
    const { phase, percent, next, served } = useAppUpdate();
    const state =
        phase === "downloading" ? (
            <span className="text-brand">
                ↓ {next}
                {percent === null ? "…" : ` ${percent}%`}
            </span>
        ) : phase === "ready" ? (
            <span className="text-brand">{t("more.updateReady")}</span>
        ) : served === APP_TAG ? (
            <span className="inline-flex items-center gap-0.5 text-green-600">
                <Check size={12} strokeWidth={3} />
                {t("more.updateIsLatest")}
            </span>
        ) : served === null ? (
            t("more.updateIsOffline")
        ) : served ? (
            <span className="text-brand">
                {t("more.updateAvailable").replace("{version}", buildLabel(served))}
            </span>
        ) : null;
    return (
        <>
            {currentVersion()}
            {state && <> · {state}</>}
        </>
    );
}
