import type { Me } from "@tea-pos/api-client/me";
import { clearCache } from "@tea-pos/api-client/query";
import { messagesFor } from "@tea-pos/i18n";
import { useLocale, useSwitchLanguage } from "@tea-pos/i18n/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useApp } from "./AppContext";
import { rememberUser, savedUser } from "./session";

/**
 * Keeps the phone in step with `/me`: another person's saved data is dropped, and
 * the profile's language becomes the phone's copy (read by pickLocale before any
 * JavaScript, so later opens need no switch), switched in place. Another person is rare, so a reload is fine.
 */
export function useMeSync(me: Me | undefined, fresh: boolean) {
    const queryClient = useQueryClient();
    const { locales } = useApp();
    const locale = useLocale();
    const switchLanguage = useSwitchLanguage();

    useEffect(() => {
        if (!me) return;
        const saved = savedUser();
        if (saved !== me.user.id) {
            rememberUser(me.user.id);
            if (saved) {
                void clearCache(queryClient).then(() => window.location.reload());
                return;
            }
        }
        // Never from the saved copy: it may hold the language just left, and each would undo the other.
        if (!fresh) return;
        const language = locales.find((l) => l === me.user.language);
        if (!language || language === locale) return;
        try {
            // The key pickLocale reads, so the next open starts in it.
            localStorage.setItem("tea-pos:locale", language);
        } catch {
            // The profile still has it: switched again on the next open.
        }
        // No signal for its words: stays as is until the next fresh /me.
        void messagesFor(language)
            .then((messages) => switchLanguage(language, messages))
            .catch(() => {});
    }, [me, fresh, queryClient, locales, locale, switchLanguage]);
}
