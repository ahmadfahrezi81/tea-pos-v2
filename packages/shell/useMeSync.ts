import type { Me } from "@tea-pos/api-client/me";
import { clearCache } from "@tea-pos/api-client/query";
import { useLocale } from "@tea-pos/i18n/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useApp } from "./AppContext";
import { rememberUser, savedUser } from "./session";

/**
 * Keeps the phone in step with `/me`: another person's saved data is dropped, and
 * the profile's language becomes the phone's copy (read by pickLocale before any
 * JavaScript, so later opens need no switch). Both are rare, so a reload is fine.
 */
export function useMeSync(me: Me | undefined) {
    const queryClient = useQueryClient();
    const { locales } = useApp();
    const locale = useLocale();

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
        const language = locales.find((l) => l === me.user.language);
        if (!language || language === locale) return;
        try {
            // The key pickLocale reads; reload only once it is saved, or it would loop.
            localStorage.setItem("tea-pos:locale", language);
        } catch {
            return;
        }
        window.location.reload();
    }, [me, queryClient, locales, locale]);
}
