import { createContext, useCallback, useContext, type ReactNode } from "react";

import { t, type Locale, type MessageKey, type Messages } from "./index";

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
