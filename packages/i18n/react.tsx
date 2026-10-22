import { createContext, useCallback, useContext, type ReactNode } from "react";

import { t, type Locale, type MessageKey, type Messages } from "./index";

const STORAGE_KEY = "tea-pos:locale";

/** The saved choice, else the phone's language, else the app's first; only languages the app offers. `/me` takes over in Step 13. */
export function pickLocale(offered: readonly [Locale, ...Locale[]]): Locale {
    let saved: string | null = null;
    try {
        saved = localStorage.getItem(STORAGE_KEY);
    } catch {
        // Private mode: nothing saved.
    }
    const phone = navigator.language.slice(0, 2).toLowerCase();
    return offered.find((l) => l === saved) ?? offered.find((l) => l === phone) ?? offered[0];
}

const I18nContext = createContext<{ locale: Locale; messages: Messages } | null>(null);

export function I18nProvider({
    locale,
    messages,
    children,
}: {
    locale: Locale;
    messages: Messages;
    children: ReactNode;
}) {
    return <I18nContext value={{ locale, messages }}>{children}</I18nContext>;
}

function useI18n() {
    const value = useContext(I18nContext);
    if (!value) throw new Error("I18nProvider is missing");
    return value;
}

export function useLocale(): Locale {
    return useI18n().locale;
}

export function useT(): (key: MessageKey) => string {
    const { messages } = useI18n();
    return useCallback((key: MessageKey) => t(messages, key), [messages]);
}
