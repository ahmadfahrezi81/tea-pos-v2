import { useT } from "@tea-pos/i18n/react";
import { useSlug } from "@tea-pos/shell/tenant";
import { ActionButton } from "@tea-pos/ui/ActionButton";
import { Avatar } from "@tea-pos/ui/Avatar";
import { DOT_GRID } from "@tea-pos/ui/dot-grid";
import { Emoji, type EmojiName } from "@tea-pos/ui/Emoji";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { useResumeStore, useTakeOver, type Gate } from "./home";

function GateIcon({ name, size = 100 }: { name: EmojiName; size?: number }) {
    return (
        <div className="relative -mx-6 mb-5 flex justify-center py-3">
            <div aria-hidden className="pointer-events-none absolute inset-0" style={DOT_GRID} />
            <Emoji name={name} size={size} className="relative" />
        </div>
    );
}

/** What stands in front of the POS: nobody can sell until the store is theirs. */
export function StoreGate({ gate }: { gate: Gate }) {
    const t = useT();
    const slug = useSlug();
    const resume = useResumeStore();
    return (
        <div className="bg-white rounded-2xl w-full flex flex-col items-center justify-center p-6">
            {gate.gate === "open" ? (
                <TakeOver gate={gate} />
            ) : gate.gate === "closed" ? (
                <div className="text-center w-full max-w-xs">
                    <GateIcon name="alarmClock" />
                    <p className="font-bold text-gray-900 text-2xl tracking-tight">
                        {t("gate.closed")}
                    </p>
                    <p className="text-base text-gray-500 mt-2">{t("gate.closedSub")}</p>
                </div>
            ) : (
                <div className="text-center w-full max-w-xs">
                    <GateIcon name="convenienceStore" />
                    <p className="font-bold text-gray-900 text-2xl tracking-tight">
                        {t("gate.notOpen")}
                    </p>
                    <p className="text-base text-gray-500 mt-2 mb-7">{t("gate.notOpenSub")}</p>
                    {gate.gate === "no_session" ? (
                        <ActionButton
                            action={() => resume.mutateAsync({})}
                            onError={() => {}}
                            resetOnSuccess
                            className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-base active:scale-95 transition-transform"
                        >
                            {t("gate.openStore")}
                        </ActionButton>
                    ) : (
                        <Link
                            to="/$tenant/manage/open"
                            params={{ tenant: slug }}
                            className="block w-full bg-green-600 text-white py-4 rounded-xl font-bold text-base active:scale-95 transition-transform"
                        >
                            {t("gate.openStore")}
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}

function TakeOver({ gate }: { gate: Gate }) {
    const t = useT();
    const takeOver = useTakeOver();
    const [code, setCode] = useState("");
    return (
        <div className="text-center w-full max-w-xs mx-auto">
            <GateIcon name="lockedWithKey" size={70} />
            <p className="font-bold text-gray-900 text-2xl tracking-tight">{t("gate.takenBy")}</p>
            {gate.sellerName && (
                <div className="flex items-center gap-2 mt-1 justify-center bg-slate-100 rounded-xl px-2 py-2 pr-4 w-fit mx-auto">
                    <Avatar url={gate.sellerAvatar} size={28} />
                    <p className="text-lg font-bold text-gray-900 truncate">{gate.sellerName}</p>
                </div>
            )}
            <p className="text-sm text-gray-500 mt-2 mb-3 leading-tight">{t("gate.askCode")}</p>
            <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="––"
                className="w-20 text-center text-3xl font-bold font-mono tracking-widest border-b-2 border-gray-300 focus:border-brand focus:outline-none bg-transparent mx-auto block mb-4"
            />
            <ActionButton
                action={() => takeOver.mutateAsync({ claimCode: code })}
                onError={() => {}}
                resetOnSuccess
                disabled={code.length !== 2}
                className="w-full bg-brand text-white py-4 rounded-xl font-bold text-base active:scale-95 transition-transform disabled:opacity-40"
            >
                {t("gate.takeOver")}
            </ActionButton>
        </div>
    );
}
