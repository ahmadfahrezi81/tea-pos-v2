import { api } from "@tea-pos/api-client";
import type { Locale } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { toast } from "@tea-pos/ui/toast";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";

import { useApp } from "./AppContext";
import { errorMessage } from "./errors";

// Every language the suite has, in the old seller app's order; an app offers only its own.
const LANGUAGES: { locale: Locale; sublabel: string }[] = [
    { locale: "en", sublabel: "English" },
    { locale: "id", sublabel: "Indonesian" },
];

/** The old seller app's language list; a language this app does not offer is shown, greyed. */
export function LanguageScreen() {
    const t = useT();
    const current = useLocale();
    const { locales } = useApp();
    const queryClient = useQueryClient();

    const pick = async (language: Locale) => {
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
        <div className="bg-white rounded-2xl px-4 py-1">
            {LANGUAGES.map(({ locale, sublabel }) => {
                const selected = locale === current;
                const offered = (locales as readonly string[]).includes(locale);
                return (
                    <button
                        key={locale}
                        onClick={() => void pick(locale)}
                        disabled={selected || !offered}
                        className="w-full flex items-center justify-between py-5 border-b-2 last:border-b-0 border-slate-100 active:bg-gray-50 disabled:active:bg-transparent"
                    >
                        <div className={`text-left ${offered ? "" : "opacity-40"}`}>
                            <p className="text-[17px] font-medium text-gray-900">
                                {t(`language.${locale}`)}
                            </p>
                            <p className="text-sm text-gray-400">{sublabel}</p>
                        </div>
                        <span
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-brand/90 bg-brand/90" : "border-gray-300"}`}
                        >
                            {selected && <Check size={16} className="text-white" strokeWidth={4} />}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
