import type en from "./en.json";
import type payArea from "./areas/pay.en.json";
import type sellerArea from "./areas/seller.en.json";
import type storeArea from "./areas/store.en.json";

export type Locale = "en" | "id";

/**
 * Every message: the core file (the shell and each app's first screen, loaded at start) and
 * the areas, each loaded with the screens that use it (`loadArea`), so the first open carries
 * only what it draws.
 */
export type Messages = typeof en & typeof storeArea & typeof payArea & typeof sellerArea;
export type Area = "store" | "pay" | "seller";

type Leaves<T, P extends string = ""> = {
    [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

// Typing each language's import as its English twin keeps their keys in step.
const areas: Record<Area, Record<Locale, () => Promise<{ default: object }>>> = {
    store: {
        en: () => import("./areas/store.en.json"),
        id: (): Promise<{ default: typeof storeArea }> => import("./areas/store.id.json"),
    },
    pay: {
        en: () => import("./areas/pay.en.json"),
        id: (): Promise<{ default: typeof payArea }> => import("./areas/pay.id.json"),
    },
    seller: {
        en: () => import("./areas/seller.en.json"),
        id: (): Promise<{ default: typeof sellerArea }> => import("./areas/seller.id.json"),
    },
};

let active: { locale: Locale; messages: Messages } | null = null;
const loaded = new Map<Area, Promise<void>>();

// Only the active language is downloaded.
export async function loadMessages(locale: Locale): Promise<Messages> {
    const mod: { default: typeof en } =
        locale === "id" ? await import("./id.json") : await import("./en.json");
    // A copy: areas are merged into it as they load.
    const messages = structuredClone(mod.default) as Messages;
    active = { locale, messages };
    return messages;
}

/**
 * Loads an area's messages into the active language, once; a route awaits it in its `loader`,
 * so its screen never draws a key before its words.
 */
export function loadArea(area: Area): Promise<void> {
    let done = loaded.get(area);
    if (!done) {
        done = (async () => {
            if (!active) throw new Error("loadMessages first");
            const { messages, locale } = active;
            const part = (await areas[area][locale]()).default as Record<
                string,
                Record<string, unknown>
            >;
            const target = messages as unknown as Record<string, Record<string, unknown>>;
            for (const [section, values] of Object.entries(part)) {
                target[section] = { ...target[section], ...values };
            }
        })();
        loaded.set(area, done);
        // A failed download (no signal) is tried again next time.
        done.catch(() => loaded.delete(area));
    }
    return done;
}

export function t(messages: Messages, key: MessageKey): string {
    let value: unknown = messages;
    for (const part of key.split(".")) value = (value as Record<string, unknown>)?.[part];
    return typeof value === "string" ? value : key;
}
