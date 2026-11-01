import { useMe } from "@tea-pos/api-client/me";
import { useT } from "@tea-pos/i18n/react";
import { SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { useSlug } from "@tea-pos/shell/tenant";
import { ICON } from "@tea-pos/ui/icon";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { DollarSign, Eye, EyeOff, XCircle } from "lucide-react";
import { useState } from "react";

import { useGate } from "./home";
import { HomeHeader } from "./HomeHeader";
import { StoreGate } from "./StoreGate";

/** Manage: the session code, expenses and closing the day. No weather: chat brings that. */
export function Manage() {
    const t = useT();
    const { data: gate } = useGate();
    const me = useMe().data;
    const slug = useSlug();
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
                <>
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
                    <SettingsGroup>
                        <SettingsRow
                            to={`/${slug}/manage/expense`}
                            icon={
                                <DollarSign size={ICON} strokeWidth={2} className="text-blue-600" />
                            }
                            label={t("manage.expenses")}
                        />
                        <SettingsRow
                            to={`/${slug}/manage/close`}
                            icon={<XCircle size={ICON} strokeWidth={2} className="text-red-500" />}
                            label={t("manage.closeDay")}
                            danger
                        />
                    </SettingsGroup>
                </>
            )}
        </div>
    );
}
