import type { components } from "@tea-pos/api-client";
import type { MessageKey, Messages } from "@tea-pos/i18n";

/** Every code Go can send (the contract lists them: httpx.Codes), plus the phone's own. */
export type ErrorCode = components["schemas"]["Error"]["code"] | "offline";

// Fails the typecheck, naming the code, when Go has one without a translation.
type Missing = Exclude<ErrorCode, keyof Messages["errors"]>;
const everyCodeTranslated: [Missing] extends [never] ? true : Missing = true;
void everyCodeTranslated;

/** What to tell the user about a failed request, in their language. */
export function errorMessage(t: (key: MessageKey) => string, error: unknown): string {
    // fetch throws TypeError when there is no connection at all.
    if (error instanceof TypeError) return t("errors.offline");
    const code = (error as { code?: string } | null)?.code ?? (error as Error | null)?.message;
    const key = `errors.${code}` as MessageKey;
    const text = t(key);
    return text === key ? t("errors.error") : text;
}
