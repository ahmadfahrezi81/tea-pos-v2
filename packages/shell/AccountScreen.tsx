import { useMe } from "@tea-pos/api-client/me";
import { useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import { useQueryClient } from "@tanstack/react-query";
import { Globe, Info, Pencil } from "lucide-react";
import { useState } from "react";

import { ConfirmSheet } from "./FormFooter";
import { signOut } from "./session";
import { rowIcon, SettingsRow } from "./Settings";
import { useSlug } from "./tenant";
import { APP_VERSION } from "./version";

/**
 * The old apps' Account: who is signed in, the settings rows (Personal details, Language, App info), then Log Out
 * and the version at the bottom. The same in every app.
 */
export function AccountScreen() {
    const t = useT();
    const queryClient = useQueryClient();
    const me = useMe().data;
    const slug = useSlug();
    const [confirm, setConfirm] = useState(false);
    if (!me || !slug) return null;
    const { user } = me;

    return (
        <div className="min-h-full flex flex-col">
            <div className="space-y-4">
                <div className="bg-white rounded-2xl p-4 flex items-center gap-4">
                    <Avatar url={user.avatarUrl} size={64} square />
                    <div className="flex-1 min-w-0">
                        <p className="text-xl font-semibold text-gray-900 leading-tight truncate">
                            {user.fullName}
                        </p>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl px-4 py-1">
                    <SettingsRow
                        to={`/${slug}/account/details`}
                        icon={<Pencil {...rowIcon} />}
                        label={t("account.personalDetails")}
                    />
                    <SettingsRow
                        to={`/${slug}/account/language`}
                        icon={<Globe {...rowIcon} />}
                        label={t("account.language")}
                    />
                    <SettingsRow
                        to={`/${slug}/account/info`}
                        icon={<Info {...rowIcon} />}
                        label={t("status.title")}
                    />
                </div>
            </div>

            <div className="mt-auto pt-4 flex flex-col items-center gap-3">
                <button
                    onClick={() => setConfirm(true)}
                    className="bg-red-500 text-white py-3 px-16 rounded-xl font-semibold text-base active:scale-[0.98] transition-transform"
                >
                    {t("common.logout")}
                </button>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 font-mono text-xs text-gray-700">
                    {t("status.version")}: v{APP_VERSION}
                </span>
            </div>

            <ConfirmSheet
                open={confirm}
                title={t("account.logoutConfirm")}
                label={t("common.logout")}
                busyLabel={t("account.signingOut")}
                tone="orange"
                emoji="refresh"
                onConfirm={() => signOut(queryClient)}
                onError={() => setConfirm(false)}
                onCancel={() => setConfirm(false)}
            />
        </div>
    );
}
