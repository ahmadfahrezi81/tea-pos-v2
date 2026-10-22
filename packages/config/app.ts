import type { Locale, MessageKey } from "@tea-pos/i18n";

/** Everything that makes one app differ from another, in one file per app (`app.config.ts`). */
export interface AppConfig {
    /** Home-screen and window title. */
    name: string;
    shortName: string;
    description: string;
    /** Brand colour: buttons, the active tab, the loading bar. Any CSS colour. */
    brand: string;
    signIn: {
        logo?: string;
        titleKey: MessageKey;
        subtitleKey: MessageKey;
    };
    /** Languages offered; the first is the default. */
    locales: readonly [Locale, ...Locale[]];
}

export const defineApp = (app: AppConfig) => app;
