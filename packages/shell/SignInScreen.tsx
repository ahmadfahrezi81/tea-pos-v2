import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { ActionButton } from "@tea-pos/ui/ActionButton";
import { useState } from "react";

import { useApp } from "./AppContext";

/** The sign-in screen for every app; words and logo come from the app's config. */
export function SignInScreen() {
    const t = useT();
    const { logo, titleKey, subtitleKey } = useApp().signIn;
    const [error, setError] = useState<MessageKey | null>(null);

    // Step 12 sends this to Go's Google sign-in; on success the button keeps spinning through the redirect.
    const signIn = async () => {
        setError("signIn.comingSoon");
        return false;
    };

    return (
        <div className="min-h-svh flex items-center justify-center bg-gray-50">
            <div className="w-full max-w-md mx-auto p-6">
                <div className="bg-gray-50 rounded-2xl p-10 flex flex-col items-center gap-8">
                    <div className="flex flex-col items-center gap-4">
                        {logo && (
                            <img src={logo} alt="" width={90} height={90} className="rounded-xl" />
                        )}
                        <div className="text-center">
                            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t(titleKey)}</h1>
                            <p className="text-base text-gray-800">{t(subtitleKey)}</p>
                        </div>
                    </div>
                    <ActionButton
                        action={signIn}
                        busyLabel={t("signIn.signingIn")}
                        className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-800 font-bold py-4 px-5 pl-4 rounded-2xl transition-all duration-100 disabled:opacity-60 disabled:cursor-not-allowed text-base shadow-[0_4px_0_0_#d1d5db,0_4px_0_1px_#e5e7eb] hover:shadow-[0_2px_0_0_#d1d5db,0_2px_0_1px_#e5e7eb] hover:translate-y-[2px] active:shadow-none active:translate-y-[4px]"
                    >
                        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden>
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        {t("signIn.google")}
                    </ActionButton>
                    {error && <p className="text-sm text-red-500 text-center">{t(error)}</p>}
                </div>
            </div>
        </div>
    );
}
