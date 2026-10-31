import type { MessageKey } from "@tea-pos/i18n";
import { formatLongDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import { Badge } from "@tea-pos/ui/Badge";
import { Callout } from "@tea-pos/ui/Callout";
import { ChoiceList } from "@tea-pos/ui/ChoiceList";
import { Switch } from "@tea-pos/ui/form/Switch";
import { InfoList, InfoRow } from "@tea-pos/ui/DetailList";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";
import { Panel, PanelLabel } from "@tea-pos/ui/Panel";
import { FormFooter } from "@tea-pos/shell/FormFooter";
import { HeaderActions, HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { SettingsGroup } from "@tea-pos/shell/Settings";
import { useAccess, useTenant } from "@tea-pos/shell/tenant";
import { useRouter } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";

import { PersonPay } from "../pay/Staff";
import { storeGroups, useSetPerson, useUacPerson, type Change, type Person } from "./uac";
import { Skeleton } from "@tea-pos/ui/Skeleton";

/** The levels each app offers (auth.Levels in Go); '' is no access. */
const LEVELS = { seller: ["", "member"], backoffice: ["", "guest", "admin"] } as const;

/** A person, read only: who they are, the apps and stores they reach; Edit changes them. */
export function PersonPage({ userId }: { userId: string }) {
    const t = useT();
    const locale = useLocale();
    const { canWrite } = useAccess();
    const stores = useTenant()?.tenant.stores ?? [];
    const { data: p } = useUacPerson(userId);
    if (!p) return <Skeleton className="h-60 rounded-2xl" />;
    const theirs = stores.filter((s) => p.storeIds.includes(s.id));
    return (
        <div className="space-y-4">
            <HeaderTitle>{p.name}</HeaderTitle>
            {canWrite && !p.owner && <HeaderActions actions={[{ kind: "edit", to: "edit" }]} />}

            <div className="bg-white rounded-2xl p-3 flex items-center gap-3">
                <Avatar url={p.avatarUrl} size={48} />
                <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold text-gray-900 leading-tight truncate">
                        {p.name}
                    </p>
                    {p.owner && <p className="text-sm text-gray-900">{t("uac.owner")}</p>}
                </div>
            </div>
            {p.owner && <p className="px-1 text-sm text-gray-900">{t("uac.ownerNote")}</p>}

            <InfoList>
                <InfoRow label={t("uac.status")}>
                    <Badge>{t(p.active ? "uac.active" : "uac.inactive")}</Badge>
                </InfoRow>
                <InfoRow label={t("account.email")}>{p.email}</InfoRow>
                <InfoRow label={t("account.phoneNumber")}>{p.phone || "—"}</InfoRow>
                <InfoRow label={t("account.memberSince")}>
                    {p.since ? formatLongDate(p.since, locale) : "—"}
                </InfoRow>
            </InfoList>

            <section className="space-y-2">
                <SectionLabel>{t("uac.apps")}</SectionLabel>
                <InfoList>
                    {(["seller", "backoffice"] as const).map((app) => (
                        <InfoRow key={app} label={t(`uac.${app}`)}>
                            {t(`uac.${p.access[app] || "none"}` as MessageKey)}
                        </InfoRow>
                    ))}
                </InfoList>
            </section>

            <section className="space-y-2">
                <SectionLabel>{t("uac.stores")}</SectionLabel>
                <InfoList>
                    {theirs.length === 0 ? (
                        <p className="text-[15px] text-gray-900">{t("uac.noStores")}</p>
                    ) : (
                        // Every store on its own line, so a long list is never cut; only the unusual say so.
                        storeGroups(theirs).flatMap((g) =>
                            g.stores.map((s) => (
                                <InfoRow key={s.id} label={s.name}>
                                    {s.status === "active" ? "" : t(g.key)}
                                </InfoRow>
                            )),
                        )
                    )}
                </InfoList>
            </section>

            <PersonPay id={p.id} />
        </div>
    );
}

/** Editing a person: their level in each app, their stores and whether they are on; saved at once. */
export function PersonEdit({ userId }: { userId: string }) {
    const { data } = useUacPerson(userId);
    if (!data) return <Skeleton className="h-60 rounded-2xl" />;
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
        <div className="space-y-4">
            <HeaderTitle>{p.name}</HeaderTitle>

            <SettingsGroup title={t("uac.status")}>
                <div className="flex items-center gap-3 py-5">
                    <p className="flex-1 text-[17px] font-medium text-gray-900">
                        {t("uac.active")}
                    </p>
                    <Switch
                        on={change.active}
                        label={t("uac.active")}
                        onChange={(active) =>
                            editable && set({ active, storeIds: active ? change.storeIds : [] })
                        }
                    />
                </div>
            </SettingsGroup>
            {!change.active && <Callout>{t("uac.offNote")}</Callout>}

            <AccessFields change={change} set={set} disabled={!editable || !change.active} />

            {editable && (
                <FormFooter
                    label={t("uac.save")}
                    busyLabel={t("uac.saving")}
                    disabled={!changed}
                    confirmTitle={t("uac.confirmTitle").replace("{name}", p.name)}
                    note={{ title: t("uac.noteTitle"), body: t("uac.confirmBody") }}
                    onSubmit={async () => {
                        await save.mutateAsync(change);
                        router.history.back();
                    }}
                />
            )}
        </div>
    );
}

const HINTS: Record<string, MessageKey> = {
    "": "uac.noneHint",
    member: "uac.memberHint",
    guest: "uac.guestHint",
    admin: "uac.adminHint",
};

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
            <Panel title={t("uac.apps")}>
                {(["seller", "backoffice"] as const).map((app) => (
                    <section key={app} className="space-y-2">
                        <PanelLabel>{t(app === "seller" ? "uac.seller" : "uac.office")}</PanelLabel>
                        <ChoiceList
                            value={change.access[app]}
                            onChange={(level) =>
                                set({ access: { ...change.access, [app]: level } })
                            }
                            choices={[...LEVELS[app]].reverse().map((level) => ({
                                value: level,
                                label: t(`uac.${level || "none"}` as MessageKey),
                                sublabel: t(HINTS[level]!),
                                disabled,
                            }))}
                        />
                    </section>
                ))}
            </Panel>

            <Panel title={t("uac.stores")}>
                {storeGroups(stores).map((g) => (
                    <section key={g.key} className="space-y-2">
                        <PanelLabel>
                            {t(g.key)} (
                            {g.stores.filter((s) => change.storeIds.includes(s.id)).length}/
                            {g.stores.length})
                        </PanelLabel>
                        <div className="bg-slate-100 rounded-xl px-4 py-1">
                            {g.stores.map((s) => {
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
                                        className="w-full flex items-center justify-between gap-3 py-5 border-b-2 last:border-b-0 border-white text-left active:bg-gray-50 disabled:opacity-40"
                                    >
                                        <span className="text-[17px] font-medium text-gray-900">
                                            {s.name}
                                        </span>
                                        <span
                                            className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${
                                                on
                                                    ? "border-brand/90 bg-brand/90 text-white"
                                                    : "border-gray-300 bg-white"
                                            }`}
                                        >
                                            {on && <Check size={16} strokeWidth={4} />}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </Panel>
        </>
    );
}
