import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

import { activate, t, type Locale, type MessageKey, type Messages } from "./index";

interface I18n {
    locale: Locale;
    messages: Messages;
    switchTo: (locale: Locale, messages: Messages) => void;
}

const I18nContext = createContext<I18n | null>(null);

/** The active language; switched in place, without a reload, by `useSwitchLanguage`. */
export function I18nProvider({
    locale,
    messages,
    children,
}: {
    locale: Locale;
    messages: Messages;
    children: ReactNode;
}) {
    const [current, setCurrent] = useState({ locale, messages });
    const switchTo = useCallback((next: Locale, nextMessages: Messages) => {
        activate(next, nextMessages);
        document.documentElement.lang = next;
        document.documentElement.dataset.locale = next;
        setCurrent({ locale: next, messages: nextMessages });
    }, []);
    return <I18nContext value={{ ...current, switchTo }}>{children}</I18nContext>;
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

/** Swaps every word on screen to another language's, loaded first with `messagesFor`. */
export function useSwitchLanguage(): (locale: Locale, messages: Messages) => void {
    return useI18n().switchTo;
}
