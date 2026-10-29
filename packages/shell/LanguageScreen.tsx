import { api } from "@tea-pos/api-client";
import type { Locale } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { ChoiceList } from "@tea-pos/ui/ChoiceList";
import { toast } from "@tea-pos/ui/toast";
import { useQueryClient } from "@tanstack/react-query";

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
        <ChoiceList
            value={current}
            onChange={(l) => void pick(l)}
            choices={LANGUAGES.map(({ locale, sublabel }) => ({
                value: locale,
                label: t(`language.${locale}`),
                sublabel,
                disabled: !(locales as readonly string[]).includes(locale),
            }))}
        />
    );
}
