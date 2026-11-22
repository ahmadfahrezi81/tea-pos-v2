import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import {
    closePermissionHelp,
    isInstalled,
    isIPhone,
    isSamsungInternet,
    usePermissionHelp,
    type PermissionKind,
} from "@tea-pos/ui/permissions";
import { Sheet } from "@tea-pos/ui/Sheet";

/**
 * The backup when the question never shows (task 077): this page in Chrome itself, where Chrome
 * asks in its address bar (an installed app has none). Same site, so allowing it there allows the
 * app too. An intent address, so Android opens Chrome and not the app again.
 */
function openInChrome() {
    const { host, pathname, search, href } = location;
    // Without Chrome, Android opens the address in the phone's own browser instead.
    location.href = `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
}

/** The steps per phone and permission; each ends with trying again. */
const STEPS: Record<"android" | "iphone" | "samsung", Record<PermissionKind, MessageKey[]>> = {
    android: {
        notifications: [
            "permission.androidNotifications1",
            "permission.androidNotifications2",
            "permission.again",
        ],
        camera: ["permission.androidCamera1", "permission.androidCamera2", "permission.again"],
    },
    iphone: {
        notifications: ["permission.iphoneNotifications", "permission.again"],
        camera: ["permission.iphoneCamera", "permission.again"],
    },
    samsung: {
        notifications: ["permission.samsung", "permission.again"],
        camera: ["permission.samsung", "permission.again"],
    },
};

/** Mounted once by the shell: what happened, the steps for this phone, and the backup. */
export function PermissionHelpHost() {
    const t = useT();
    const help = usePermissionHelp();
    if (!help) return null;
    const phone = isSamsungInternet() ? "samsung" : isIPhone() ? "iphone" : "android";
    const site = (key: MessageKey) => t(key).replace("{site}", location.host);
    const steps = STEPS[phone][help.kind].map(site);
    const said: Record<typeof help.problem, MessageKey> = {
        blocked: "permission.blocked",
        notAsked: "permission.notAsked",
        failed: "permission.failed",
    };
    return (
        <Sheet
            open
            onClose={closePermissionHelp}
            title={t(
                help.kind === "camera" ? "permission.titleCamera" : "permission.titleNotifications",
            )}
        >
            <div className="space-y-4 pb-2">
                <p className="text-[15px] text-gray-700">{t(said[help.problem])}</p>
                {help.problem !== "failed" && (
                    <ol className="list-decimal space-y-2 pl-5 text-[15px] text-gray-900">
                        {steps.map((s) => (
                            <li key={s}>{s}</li>
                        ))}
                    </ol>
                )}
                {phone === "android" && isInstalled() && help.problem !== "failed" && (
                    <div className="space-y-1.5">
                        <button
                            type="button"
                            onClick={openInChrome}
                            className="w-full rounded-xl bg-slate-100 py-3 text-[16px] font-semibold text-gray-900 active:opacity-80"
                        >
                            {t("permission.openInChrome")}
                        </button>
                        <p className="text-center text-[13px] text-gray-600">
                            {t("permission.openInChromeSub")}
                        </p>
                    </div>
                )}
                <button
                    type="button"
                    onClick={closePermissionHelp}
                    className="w-full rounded-xl bg-brand py-3 text-[16px] font-semibold text-white active:opacity-80"
                >
                    {t("permission.gotIt")}
                </button>
            </div>
        </Sheet>
    );
}
