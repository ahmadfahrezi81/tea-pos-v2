import type en from "./en.json";

export type Locale = "en" | "id";
export type Messages = typeof en;

type Leaves<T, P extends string = ""> = {
    [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;

// Only the active language is downloaded; typing both as Messages keeps their keys in step.
export async function loadMessages(locale: Locale): Promise<Messages> {
    const mod = locale === "id" ? await import("./id.json") : await import("./en.json");
    return mod.default;
}

export function t(messages: Messages, key: MessageKey): string {
    let value: unknown = messages;
    for (const part of key.split(".")) value = (value as Record<string, unknown>)[part];
    return typeof value === "string" ? value : key;
}
