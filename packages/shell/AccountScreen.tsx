import { api } from "@tea-pos/api-client";
import { useMe } from "@tea-pos/api-client/me";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { ActionButton } from "@tea-pos/ui/ActionButton";
import { Avatar } from "@tea-pos/ui/Avatar";
import { ConfirmDialog } from "@tea-pos/ui/ConfirmDialog";
import { Sheet } from "@tea-pos/ui/Sheet";
import { toast } from "@tea-pos/ui/toast";
import { useQueryClient } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { useState } from "react";

import { useApp } from "./AppContext";
import { errorMessage } from "./errors";
import { signOut, signOutEverywhere } from "./session";
import { rowIcon, SettingsRow } from "./Settings";
import { APP_VERSION } from "./version";

/**
 * The old apps' Account: who is signed in, the settings rows, then Log Out and the version at
 * the bottom. The same in every app.
 */
export function AccountScreen() {
    const t = useT();
    const locale = useLocale();
    const { locales } = useApp();
    const queryClient = useQueryClient();
    const me = useMe().data;
    const [language, setLanguageOpen] = useState(false);
    const [confirm, setConfirm] = useState(false);
    if (!me) return null;
    const { user } = me;

    const setLanguage = async (language: (typeof locales)[number]) => {
        // Not saved (no signal): stay in this language, or the next /me would switch it back.
        const saved = await api
            .PATCH("/me", { body: { language } })
            .catch((e: unknown) => ({ error: e }));
        if (saved.error) return toast(errorMessage(t, saved.error));
        try {
            // The key pickLocale reads before any JavaScript, so the next open starts in it.
            localStorage.setItem("tea-pos:locale", language);
        } catch {
            // Without storage the profile still has it; useMeSync applies it on the next open.
        }
        await queryClient.invalidateQueries({ queryKey: ["me"] });
        window.location.reload();
    };

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

                {locales.length > 1 && (
                    <div className="bg-white rounded-2xl px-4 py-1">
                        <SettingsRow
                            icon={<Globe {...rowIcon} />}
                            label={t("account.language")}
                            sublabel={t(`language.${locale}`)}
                            onClick={() => setLanguageOpen(true)}
                        />
                    </div>
                )}
            </div>

            <div className="mt-auto pt-4 flex flex-col items-center gap-3">
                <button
                    onClick={() => setConfirm(true)}
                    className="bg-red-500 text-white py-3 px-16 rounded-xl font-semibold text-base active:scale-[0.98] transition-transform"
                >
                    {t("common.logout")}
                </button>
                <ActionButton
                    action={() => signOutEverywhere(queryClient)}
                    busyLabel={t("account.signingOut")}
                    className="text-sm text-gray-500 underline"
                >
                    {t("account.signOutEverywhere")}
                </ActionButton>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 font-mono text-xs text-gray-700">
                    {t("status.version")}: v{APP_VERSION}
                </span>
            </div>

            <Sheet
                open={language}
                onClose={() => setLanguageOpen(false)}
                title={t("language.title")}
            >
                <div className="flex flex-col gap-2">
                    {locales.map((l) => (
                        <ActionButton
                            key={l}
                            action={() => setLanguage(l)}
                            busyLabel={t(`language.${l}`)}
                            className={`w-full rounded-xl py-3 text-base font-semibold ${l === locale ? "bg-brand text-white" : "bg-gray-100 text-gray-700"}`}
                        >
                            {t(`language.${l}`)}
                        </ActionButton>
                    ))}
                </div>
            </Sheet>

            <ConfirmDialog
                open={confirm}
                type="warning"
                title={t("common.logout")}
                message={t("account.logoutConfirm")}
                confirmText={t("common.logout")}
                cancelText={t("common.cancel")}
                onCancel={() => setConfirm(false)}
                onConfirm={() => {
                    setConfirm(false);
                    void signOut(queryClient);
                }}
            />
        </div>
    );
}
