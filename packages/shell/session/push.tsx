import { PushNotOn, pushState, turnPushOn, type PushState } from "@tea-pos/api-client/chat";
import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { Sheet } from "@tea-pos/ui/Sheet";
import { useState } from "react";

import { reportError } from "../lib/events";

type Reason = PushNotOn["reason"];

const iPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

/**
 * Turn on, for the Chats card and Account → Notifications. When the phone does not say yes, a
 * sheet says where to allow them (as v1's camera), and the reason goes to PostHog (task 077).
 */
export function useTurnPushOn(onState: (s: PushState) => void) {
    const [busy, setBusy] = useState(false);
    const [help, setHelp] = useState<Reason | null>(null);
    const turnOn = async () => {
        if (busy) return;
        setBusy(true);
        try {
            await turnPushOn();
        } catch (e) {
            reportError(e);
            setHelp(e instanceof PushNotOn ? e.reason : "failed");
        }
        onState(await pushState());
        setBusy(false);
    };
    const sheet = <PushHelp reason={help} onClose={() => setHelp(null)} />;
    return { turnOn, busy, sheet };
}

const STEPS: Record<"android" | "iphone", MessageKey[]> = {
    android: ["push.android1", "push.android2", "push.android3"],
    iphone: ["push.iphone1", "push.iphone2"],
};

function PushHelp({ reason, onClose }: { reason: Reason | null; onClose: () => void }) {
    const t = useT();
    const steps = STEPS[iPhone() ? "iphone" : "android"];
    return (
        <Sheet open={reason !== null} onClose={onClose} title={t("push.title")}>
            <div className="space-y-4 pb-2">
                <p className="text-[15px] text-gray-700">
                    {t(reason === "failed" ? "push.failed" : "push.notAllowed")}
                </p>
                {reason !== "failed" && (
                    <ol className="list-decimal space-y-2 pl-5 text-[15px] text-gray-900">
                        {steps.map((k) => (
                            <li key={k}>{t(k)}</li>
                        ))}
                    </ol>
                )}
                <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-xl bg-brand py-3 text-[16px] font-semibold text-white active:opacity-80"
                >
                    {t("push.gotIt")}
                </button>
            </div>
        </Sheet>
    );
}
