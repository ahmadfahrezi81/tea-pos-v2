import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { ChoiceList } from "@tea-pos/ui/ChoiceList";
import { Switch } from "@tea-pos/ui/form/Switch";
import { Sheet } from "@tea-pos/ui/Sheet";
import { LayoutGrid, Store, UserX } from "lucide-react";
import { useState } from "react";

import type { Person } from "./uac";

/** The levels each app offers, plus any; '' is no access (as on the person's page). */
const LEVELS = {
    seller: ["any", "member", ""],
    backoffice: ["any", "admin", "guest", ""],
} as const;
type App = keyof typeof LEVELS;

export type PeopleFilter = {
    seller: (typeof LEVELS.seller)[number];
    backoffice: (typeof LEVELS.backoffice)[number];
    inactive: boolean;
};

export const NO_FILTER: PeopleFilter = { seller: "any", backoffice: "any", inactive: false };

export const isFiltered = (f: PeopleFilter) =>
    f.seller !== "any" || f.backoffice !== "any" || f.inactive;

/** The owner counts as every app's top level. */
export function matches(f: PeopleFilter, p: Person): boolean {
    if (!p.active) return f.inactive && f.seller === "any" && f.backoffice === "any";
    const level = (app: App) => (p.owner ? (app === "seller" ? "member" : "admin") : p.access[app]);
    return (
        (f.seller === "any" || level("seller") === f.seller) &&
        (f.backoffice === "any" || level("backoffice") === f.backoffice)
    );
}

const levelKey = (l: string): MessageKey => `uac.${l || "none"}` as MessageKey;

/** The filter, one app at a time: a row per app opens its levels; a switch for inactive people. */
export function PeopleFilterSheet({
    open,
    value,
    onChange,
    onClose,
}: {
    open: boolean;
    value: PeopleFilter;
    onChange: (f: PeopleFilter) => void;
    onClose: () => void;
}) {
    const t = useT();
    const [app, setApp] = useState<App | null>(null);
    const appLabel = (a: App) => t(a === "seller" ? "uac.seller" : "uac.office");
    const close = () => {
        setApp(null);
        onClose();
    };

    return (
        <Sheet
            open={open}
            onClose={close}
            title={app ? appLabel(app) : t("uac.filter")}
            onBack={app ? () => setApp(null) : undefined}
        >
            {app ? (
                <ChoiceList
                    value={value[app]}
                    onChange={(level) => {
                        onChange({ ...value, [app]: level });
                        setApp(null);
                    }}
                    choices={LEVELS[app].map((l) => ({
                        value: l,
                        label: t(l === "any" ? "uac.any" : levelKey(l)),
                    }))}
                />
            ) : (
                <div className="space-y-4">
                    <div>
                        <SettingsGroup>
                            {(["seller", "backoffice"] as const).map((a) => (
                                <SettingsRow
                                    key={a}
                                    icon={
                                        a === "seller" ? (
                                            <Store {...rowIcon} />
                                        ) : (
                                            <LayoutGrid {...rowIcon} />
                                        )
                                    }
                                    label={appLabel(a)}
                                    sublabel={t(
                                        value[a] === "any" ? "uac.any" : levelKey(value[a]),
                                    )}
                                    onClick={() => setApp(a)}
                                />
                            ))}
                            <div className="flex items-center gap-3 py-5">
                                <UserX {...rowIcon} />
                                <p className="flex-1 text-[17px] font-medium text-gray-800">
                                    {t("uac.showInactive")}
                                </p>
                                <Switch
                                    on={value.inactive}
                                    onChange={(inactive) => onChange({ ...value, inactive })}
                                    label={t("uac.showInactive")}
                                />
                            </div>
                        </SettingsGroup>
                    </div>
                    {isFiltered(value) && (
                        <button
                            onClick={() => onChange(NO_FILTER)}
                            className="w-full py-3 rounded-xl bg-gray-100 font-semibold text-gray-900 active:bg-gray-200"
                        >
                            {t("uac.reset")}
                        </button>
                    )}
                </div>
            )}
        </Sheet>
    );
}
