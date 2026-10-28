import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { avatar } from "@tea-pos/shell/avatar";
import { FormFooter } from "@tea-pos/shell/FormFooter";
import { HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { useAccess, useTenant } from "@tea-pos/shell/tenant";
import { useRouter } from "@tanstack/react-router";
import { Check, UserCircle } from "lucide-react";
import { useState } from "react";

import { useSetPerson, useUacPerson, type Change, type Person } from "./uac";

/** The levels each app offers (auth.Levels in Go); '' is no access. */
const LEVELS = { seller: ["", "member"], backoffice: ["", "guest", "admin"] } as const;

/** A person: their level in each app, their stores and whether they are on; saved at once. */
export function PersonPage({ userId }: { userId: string }) {
    const { data } = useUacPerson(userId);
    if (!data) return <div className="h-60 rounded-2xl bg-white" />;
    // Keyed by what was saved, so a change from elsewhere starts the form again.
    return <PersonForm key={JSON.stringify(data)} person={data} />;
}

function PersonForm({ person: p }: { person: Person }) {
    const t = useT();
    const router = useRouter();
    const { canWrite } = useAccess();
    const save = useSetPerson(p.id);
    const [change, setChange] = useState<Change>({
        access: p.access,
        storeIds: p.storeIds,
        active: p.active,
    });
    const editable = canWrite && !p.owner;
    const set = (next: Partial<Change>) => setChange((c) => ({ ...c, ...next }));
    const changed =
        JSON.stringify(change) !==
        JSON.stringify({ access: p.access, storeIds: p.storeIds, active: p.active });

    return (
        <div className="space-y-4 pb-24">
            <HeaderTitle>{p.name}</HeaderTitle>

            <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
                {p.avatarUrl ? (
                    <img
                        src={avatar(p.avatarUrl)}
                        alt=""
                        width={44}
                        height={44}
                        referrerPolicy="no-referrer"
                        className="size-11 rounded-full object-cover"
                    />
                ) : (
                    <UserCircle size={44} className="text-gray-400" />
                )}
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-600">{p.email}</p>
                    <p
                        className={`text-sm font-semibold ${change.active ? "text-green-600" : "text-gray-400"}`}
                    >
                        {change.active ? `● ${t("uac.active")}` : `○ ${t("uac.inactive")}`}
                        {p.owner && <span className="text-gray-900"> · {t("uac.owner")}</span>}
                    </p>
                </div>
            </div>
            {p.owner && <p className="px-1 text-sm text-gray-500">{t("uac.ownerNote")}</p>}

            <AccessFields change={change} set={set} disabled={!editable || !change.active} />

            {editable && (
                <div className="space-y-2">
                    <button
                        onClick={() =>
                            set({
                                active: !change.active,
                                storeIds: change.active ? [] : change.storeIds,
                            })
                        }
                        className={`w-full rounded-xl py-3 font-semibold ${
                            change.active ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
                        }`}
                    >
                        {t(change.active ? "uac.deactivate" : "uac.activate")}
                    </button>
                    {!change.active && (
                        <p className="px-1 text-xs text-gray-500">{t("uac.offNote")}</p>
                    )}
                </div>
            )}

            {editable && changed && (
                <FormFooter
                    label={t("uac.save")}
                    busyLabel={t("uac.saving")}
                    confirmTitle={t("uac.confirmTitle").replace("{name}", p.name)}
                    confirmMessage={t("uac.confirmBody")}
                    note={{ title: t("uac.apps"), body: t("uac.confirmBody") }}
                    onSubmit={async () => {
                        await save.mutateAsync(change);
                        router.history.back();
                    }}
                />
            )}
        </div>
    );
}

/** The level in each app and the stores: the same fields for a person and for a request. */
export function AccessFields({
    change,
    set,
    disabled,
}: {
    change: Change;
    set: (next: Partial<Change>) => void;
    disabled: boolean;
}) {
    const t = useT();
    const stores = useTenant()?.tenant.stores ?? [];
    return (
        <>
            <section className="space-y-2">
                <p className="px-1 text-sm font-semibold text-gray-500">{t("uac.apps")}</p>
                <div className="space-y-3 rounded-2xl bg-white p-4">
                    {(["seller", "backoffice"] as const).map((app) => (
                        <div key={app} className="flex items-center justify-between gap-3">
                            <span className="text-gray-900">{t(`uac.${app}`)}</span>
                            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                                {LEVELS[app].map((level) => (
                                    <button
                                        key={level}
                                        disabled={disabled}
                                        onClick={() =>
                                            set({ access: { ...change.access, [app]: level } })
                                        }
                                        className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
                                            change.access[app] === level
                                                ? "bg-white text-gray-900 shadow-sm"
                                                : "text-gray-500"
                                        }`}
                                    >
                                        {t(`uac.${level || "none"}` as MessageKey)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="space-y-2">
                <p className="px-1 text-sm font-semibold text-gray-500">{t("uac.stores")}</p>
                <div className="overflow-hidden rounded-2xl bg-white">
                    {stores.map((s, i) => {
                        const on = change.storeIds.includes(s.id);
                        return (
                            <button
                                key={s.id}
                                disabled={disabled}
                                onClick={() =>
                                    set({
                                        storeIds: on
                                            ? change.storeIds.filter((id) => id !== s.id)
                                            : [...change.storeIds, s.id],
                                    })
                                }
                                className={`flex w-full items-center gap-3 p-3 text-left active:bg-gray-50 disabled:opacity-60 ${
                                    i < stores.length - 1 ? "border-b border-gray-100" : ""
                                }`}
                            >
                                <span
                                    className={`flex size-5 items-center justify-center rounded border ${
                                        on ? "border-brand bg-brand text-white" : "border-gray-300"
                                    }`}
                                >
                                    {on && <Check size={14} strokeWidth={3} />}
                                </span>
                                <span className="text-gray-900">{s.name}</span>
                            </button>
                        );
                    })}
                </div>
            </section>
        </>
    );
}
