import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { closePermissionHelp, isIPhone, usePermissionHelp } from "@tea-pos/ui/permissions";
import { Sheet } from "@tea-pos/ui/Sheet";

const installed = () => matchMedia("(display-mode: standalone)").matches;

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

/** Installed from Samsung Internet: its own menus, and no Chrome to send them to. */
const samsung = () => /SamsungBrowser/.test(navigator.userAgent);

/** Mounted once by the shell: what happened, the steps for this phone, and the backup. */
export function PermissionHelpHost() {
    const t = useT();
    const help = usePermissionHelp();
    if (!help) return null;
    const camera = help.kind === "camera";
    const iphone = isIPhone();
    const steps: string[] = samsung()
        ? [t("permission.samsung").replace("{site}", location.host), t("permission.again")]
        : iphone
          ? [
                t(camera ? "permission.iphoneCamera" : "permission.iphoneNotifications"),
                t("permission.again"),
            ]
          : [
                t(camera ? "permission.androidCamera1" : "permission.androidNotifications1"),
                t(
                    camera ? "permission.androidCamera2" : "permission.androidNotifications2",
                ).replace("{site}", location.host),
                t("permission.again"),
            ];
    const said: Record<typeof help.problem, MessageKey> = {
        blocked: "permission.blocked",
        notAsked: "permission.notAsked",
        failed: "permission.failed",
    };
    return (
        <Sheet
            open
            onClose={closePermissionHelp}
            title={t(camera ? "permission.titleCamera" : "permission.titleNotifications")}
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
                {!iphone && !samsung() && installed() && help.problem !== "failed" && (
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
