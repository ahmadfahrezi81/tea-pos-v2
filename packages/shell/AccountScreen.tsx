import { api } from "@tea-pos/api-client";
import { useMe } from "@tea-pos/api-client/me";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { ActionButton } from "@tea-pos/ui/ActionButton";
import { toast } from "@tea-pos/ui/toast";
import { useQueryClient } from "@tanstack/react-query";

import { useApp } from "./AppContext";
import { avatar } from "./avatar";
import { errorMessage } from "./errors";
import { signOut, signOutEverywhere } from "./session";
import { StatusScreen } from "./StatusScreen";

/** Who is signed in, their language, signing out, and which build runs: the same in every app. */
export function AccountScreen() {
    const t = useT();
    const locale = useLocale();
    const { locales } = useApp();
    const queryClient = useQueryClient();
    const me = useMe().data;
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
        <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-white p-4 flex items-center gap-3">
                {user.avatarUrl ? (
                    <img
                        src={avatar(user.avatarUrl)}
                        alt=""
                        width={48}
                        height={48}
                        referrerPolicy="no-referrer"
                        className="size-12 rounded-full"
                    />
                ) : (
                    <div className="size-12 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500">
                        {user.fullName.slice(0, 1)}
                    </div>
                )}
                <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{user.fullName}</p>
                    <p className="text-sm text-gray-500 truncate">
                        {t(`home.roles.${user.role}` as MessageKey)} · {user.email}
                    </p>
                </div>
            </div>

            {locales.length > 1 && (
                <div className="rounded-2xl bg-white p-4">
                    <p className="text-sm text-gray-500 mb-2">{t("language.title")}</p>
                    <div className="flex gap-2">
                        {locales.map((l) => (
                            <ActionButton
                                key={l}
                                action={() => setLanguage(l)}
                                busyLabel={t(`language.${l}`)}
                                className={`flex-1 rounded-xl py-3 text-sm font-semibold ${l === locale ? "bg-brand text-white" : "bg-gray-100 text-gray-700"}`}
                            >
                                {t(`language.${l}`)}
                            </ActionButton>
                        ))}
                    </div>
                </div>
            )}

            <div className="rounded-2xl bg-white divide-y divide-gray-100">
                <ActionButton
                    action={() => signOut(queryClient)}
                    busyLabel={t("account.signingOut")}
                    className="w-full p-4 text-left text-sm font-bold text-red-600"
                >
                    {t("account.signOut")}
                </ActionButton>
                <ActionButton
                    action={() => signOutEverywhere(queryClient)}
                    busyLabel={t("account.signingOut")}
                    className="w-full p-4 text-left text-sm text-red-600"
                >
                    {t("account.signOutEverywhere")}
                </ActionButton>
            </div>

            <StatusScreen />
        </div>
    );
}
