import { useMe } from "@tea-pos/api-client/me";
import { useT } from "@tea-pos/i18n/react";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { useGate } from "./home";
import { HomeHeader } from "./HomeHeader";
import { StoreGate } from "./StoreGate";

/** Manage: the session code; expenses and closing the day join it. No weather: chat brings that. */
export function Manage() {
    const t = useT();
    const { data: gate } = useGate();
    const me = useMe().data;
    const [shown, setShown] = useState(false);
    if (!gate)
        return (
            <div className="space-y-4">
                <HomeHeader />
                <Skeleton className="h-40 rounded-2xl" />
            </div>
        );
    const mine = gate.gate === "open" && gate.sellerId === me?.user.id;
    return (
        <div className="flex flex-col gap-4 min-h-full">
            <HomeHeader />
            {!mine ? (
                <StoreGate gate={gate} />
            ) : (
                <button
                    onClick={() => setShown((v) => !v)}
                    className="bg-white rounded-2xl flex items-center gap-3 p-4 active:bg-gray-50 text-left"
                >
                    <span className="flex-1">
                        <span className="block text-xs text-gray-500 font-medium uppercase tracking-wide">
                            {t("manage.sessionCode")}
                        </span>
                        <span className="block text-2xl font-bold font-mono tracking-widest text-gray-900 mt-0.5">
                            {shown ? gate.claimCode : "••"}
                        </span>
                    </span>
                    <span className="text-gray-400 shrink-0">
                        {shown ? <EyeOff size={16} /> : <Eye size={16} />}
                    </span>
                </button>
            )}
        </div>
    );
}
