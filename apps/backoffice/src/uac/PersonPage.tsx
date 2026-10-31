import type { MessageKey } from "@tea-pos/i18n";
import { formatLongDate, formatMoney } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { ActionButton } from "@tea-pos/ui/ActionButton";
import { Avatar } from "@tea-pos/ui/Avatar";
import { Callout } from "@tea-pos/ui/Callout";
import { ChoiceList } from "@tea-pos/ui/ChoiceList";
import { Field } from "@tea-pos/ui/form/Field";
import { Segmented } from "@tea-pos/ui/form/Segmented";
import { Switch } from "@tea-pos/ui/form/Switch";
import { TextInput } from "@tea-pos/ui/form/TextInput";
import { Panel, PanelLabel } from "@tea-pos/ui/Panel";
import { Sheet } from "@tea-pos/ui/Sheet";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { ConfirmSheet } from "@tea-pos/shell/FormFooter";
import { HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { useAccess, useTenant } from "@tea-pos/shell/tenant";
import {
    BadgePercent,
    Check,
    LayoutGrid,
    Pencil,
    ReceiptText,
    Store,
    UserCheck,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { PersonBank } from "../pay/Staff";
import { useClaimTypes, useCommissionTypes, usePayWrite, writes } from "../pay/pay";
import {
    storeGroups,
    useSetDetails,
    useSetPerson,
    useUacPerson,
    type Change,
    type Person,
} from "./uac";

/** The levels each app offers (auth.Levels in Go); '' is no access. */
const LEVELS = { seller: ["", "member"], backoffice: ["", "guest", "admin"] } as const;

const HINTS: Record<string, MessageKey> = {
    "": "uac.noneHint",
    member: "uac.memberHint",
    guest: "uac.guestHint",
    admin: "uac.adminHint",
};

type Editing = "details" | "apps" | "stores" | "commission" | "claims";

/** A person, everything at a glance: each row opens its own short sheet, so one change is one tap. */
export function PersonPage({ userId }: { userId: string }) {
    const t = useT();
    const locale = useLocale();
    const { canWrite } = useAccess();
    const stores = useTenant()?.tenant.stores ?? [];
    const { data: p } = useUacPerson(userId);
    const { data: claimTypes } = useClaimTypes();
    const [editing, setEditing] = useState<Editing | null>(null);
    if (!p) return <Skeleton className="h-60 rounded-2xl" />;
    const close = () => setEditing(null);
    // The owner keeps full access, and someone turned off has none to change.
    const access = canWrite && !p.owner && p.active;
    const level = (app: "seller" | "backoffice") =>
        `${t(app === "seller" ? "uac.seller" : "uac.office")}: ${t(`uac.${p.access[app] || "none"}` as MessageKey)}`;
    const row = (
        key: Editing,
        icon: ReactNode,
        label: string,
        sublabel: string,
        editable: boolean,
    ) => (
        <SettingsRow
            icon={icon}
            label={label}
            sublabel={sublabel}
            onClick={editable ? () => setEditing(key) : undefined}
            right={editable ? undefined : <></>}
        />
    );
    return (
        <div className="space-y-4">
            <HeaderTitle>{p.name}</HeaderTitle>

            <div className="bg-white rounded-2xl p-3 flex items-center gap-3">
                <Avatar url={p.avatarUrl} size={48} />
                <div className="flex-1 min-w-0 text-sm text-gray-900">
                    <p className="text-lg font-semibold leading-tight truncate">{p.name}</p>
                    <p className="truncate">{p.email}</p>
                    <p className="truncate">
                        {[p.phone, p.since && formatLongDate(p.since, locale)]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                </div>
            </div>
            {p.owner && <p className="px-1 text-sm text-gray-900">{t("uac.ownerNote")}</p>}
            {!p.active && <Callout>{t("uac.offNote")}</Callout>}

            <SettingsGroup>
                <StatusRow person={p} editable={canWrite && !p.owner} />
                {row(
                    "details",
                    <Pencil {...rowIcon} />,
                    t("uac.details"),
                    p.phone ? `${p.name} · ${p.phone}` : p.name,
                    canWrite,
                )}
                {row(
                    "apps",
                    <LayoutGrid {...rowIcon} />,
                    t("uac.apps"),
                    `${level("seller")} · ${level("backoffice")}`,
                    access,
                )}
                {row(
                    "stores",
                    <Store {...rowIcon} />,
                    t("uac.stores"),
                    stores
                        .filter((s) => p.storeIds.includes(s.id))
                        .map((s) => s.name)
                        .join(", ") || t("uac.noStores"),
                    access,
                )}
                {row(
                    "commission",
                    <BadgePercent {...rowIcon} />,
                    t("pay.commissionType"),
                    p.commissionName
                        ? `${p.commissionName} · ${t("pay.perCup").replace("{rate}", formatMoney(p.commissionRate))}`
                        : t("pay.noCommission"),
                    canWrite,
                )}
                {row(
                    "claims",
                    <ReceiptText {...rowIcon} />,
                    t("pay.claims"),
                    claimTypes?.types
                        .filter((c) => p.claimTypeIds.includes(c.id))
                        .map((c) => c.name)
                        .join(", ") || t("uac.noClaims"),
                    canWrite,
                )}
            </SettingsGroup>

            <PersonBank id={p.id} />

            <Sheet open={editing === "details"} onClose={close} title={t("uac.details")}>
                <DetailsForm person={p} onDone={close} />
            </Sheet>
            <Sheet open={editing === "apps"} onClose={close} title={t("uac.apps")}>
                <ChangeForm person={p} onDone={close} fields={AppLevels} />
            </Sheet>
            <Sheet open={editing === "stores"} onClose={close} title={t("uac.stores")}>
                <ChangeForm person={p} onDone={close} fields={StoreChecks} />
            </Sheet>
            <Sheet open={editing === "commission"} onClose={close} title={t("pay.commissionType")}>
                <CommissionForm person={p} onDone={close} />
            </Sheet>
            <Sheet open={editing === "claims"} onClose={close} title={t("pay.claims")}>
                <ClaimsForm person={p} onDone={close} />
            </Sheet>
        </div>
    );
}

/** On or off, right on the row; turning off clears their access, so it asks first. */
function StatusRow({ person: p, editable }: { person: Person; editable: boolean }) {
    const t = useT();
    const save = useSetPerson(p.id);
    const [asking, setAsking] = useState(false);
    const words = {
        title: p.active ? "uac.offTitle" : "uac.onTitle",
        body: p.active ? "uac.offBody" : "uac.onBody",
    } as const;
    return (
        <div className="flex items-center gap-3 border-b-2 border-slate-100 py-4">
            <UserCheck {...rowIcon} />
            <div className="flex-1 min-w-0">
                <p className="text-[17px] font-medium text-gray-800">{t("uac.status")}</p>
                <p className="text-xs text-gray-500">
                    {t(p.active ? "uac.active" : "uac.inactive")}
                </p>
            </div>
            {editable && (
                <Switch on={p.active} label={t("uac.active")} onChange={() => setAsking(true)} />
            )}
            <ConfirmSheet
                open={asking}
                title={t(words.title).replace("{name}", p.name)}
                message={t(words.body)}
                label={t("uac.save")}
                busyLabel={t("uac.saving")}
                onConfirm={async () => {
                    await save.mutateAsync({
                        access: p.access,
                        storeIds: p.storeIds,
                        active: !p.active,
                    });
                    setAsking(false);
                }}
                onError={() => setAsking(false)}
                onCancel={() => setAsking(false)}
            />
        </div>
    );
}

/** A sheet's save button, kept in view under a long list. */
function SaveButton({ onSave, disabled }: { onSave: () => Promise<unknown>; disabled?: boolean }) {
    const t = useT();
    return (
        <div className="sticky bottom-0 bg-white pt-3 pb-1">
            <ActionButton
                action={onSave}
                onError={() => {}}
                resetOnSuccess
                busyLabel={t("uac.saving")}
                disabled={disabled}
                className="w-full rounded-xl bg-brand py-4 text-base font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
                {t("uac.save")}
            </ActionButton>
        </div>
    );
}

function DetailsForm({ person: p, onDone }: { person: Person; onDone: () => void }) {
    const t = useT();
    const save = useSetDetails(p.id);
    const [fullName, setName] = useState(p.name);
    const [phone, setPhone] = useState(p.phone ?? "");
    return (
        <div className="space-y-3">
            <Field label={t("pay.name")} required>
                <TextInput value={fullName} onChange={setName} className="text-base font-medium" />
            </Field>
            <Field label={t("account.phoneNumber")}>
                <TextInput
                    value={phone}
                    onChange={setPhone}
                    inputMode="tel"
                    className="text-base font-medium"
                />
            </Field>
            <SaveButton
                disabled={!fullName.trim()}
                onSave={async () => {
                    await save.mutateAsync({ fullName, phone });
                    onDone();
                }}
            />
        </div>
    );
}

type Fields = (props: {
    change: Change;
    set: (next: Partial<Change>) => void;
    disabled: boolean;
}) => ReactNode;

/** Apps or stores: the rest of what the save sends stays as it is. */
function ChangeForm({
    person: p,
    fields: Fields,
    onDone,
}: {
    person: Person;
    fields: Fields;
    onDone: () => void;
}) {
    const save = useSetPerson(p.id);
    const [change, setChange] = useState<Change>({
        access: p.access,
        storeIds: p.storeIds,
        active: p.active,
    });
    return (
        <div className="space-y-3">
            <Fields
                change={change}
                set={(next) => setChange((c) => ({ ...c, ...next }))}
                disabled={false}
            />
            <SaveButton
                onSave={async () => {
                    await save.mutateAsync(change);
                    onDone();
                }}
            />
        </div>
    );
}

function CommissionForm({ person: p, onDone }: { person: Person; onDone: () => void }) {
    const t = useT();
    const { data } = useCommissionTypes();
    const save = usePayWrite(writes.setStaffCommission);
    const [picked, setPicked] = useState(p.commissionTypeId ?? "");
    if (!data) return <Skeleton className="h-40 rounded-xl" />;
    return (
        <div className="space-y-3">
            <ChoiceList
                value={picked}
                onChange={setPicked}
                choices={[
                    { value: "", label: t("pay.none"), sublabel: t("pay.noCommission") },
                    ...data.types
                        .filter((c) => c.enabled)
                        .map((c) => ({
                            value: c.id,
                            label: c.name,
                            sublabel: t("pay.perCup").replace("{rate}", formatMoney(c.ratePerCup)),
                        })),
                ]}
            />
            <SaveButton
                onSave={async () => {
                    await save.mutateAsync({ userId: p.id, commissionTypeId: picked || null });
                    onDone();
                }}
            />
        </div>
    );
}

function ClaimsForm({ person: p, onDone }: { person: Person; onDone: () => void }) {
    const t = useT();
    const { data } = useClaimTypes();
    const save = usePayWrite(writes.setStaffClaims);
    const [picked, setPicked] = useState(p.claimTypeIds);
    if (!data) return <Skeleton className="h-40 rounded-xl" />;
    const enabled = data.types.filter((c) => c.enabled);
    return (
        <div className="space-y-3">
            <div className="bg-slate-100 rounded-xl px-4 py-1">
                {enabled.length === 0 ? (
                    <p className="py-3 text-sm text-gray-900">{t("uac.noClaims")}</p>
                ) : (
                    enabled.map((c) => (
                        <CheckRow
                            key={c.id}
                            label={c.name}
                            sublabel={formatMoney(c.amount)}
                            on={picked.includes(c.id)}
                            onToggle={() => setPicked((ids) => toggled(ids, c.id))}
                        />
                    ))
                )}
            </div>
            <SaveButton
                onSave={async () => {
                    await save.mutateAsync({ userId: p.id, claimTypeIds: picked });
                    onDone();
                }}
            />
        </div>
    );
}

const toggled = (ids: string[], id: string) =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

function CheckRow({
    label,
    sublabel,
    on,
    onToggle,
    disabled,
}: {
    label: string;
    sublabel?: string;
    on: boolean;
    onToggle: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onToggle}
            className="w-full flex items-center justify-between gap-3 py-3 border-b-2 last:border-b-0 border-white text-left active:opacity-70 disabled:opacity-40"
        >
            <span className="min-w-0">
                <span className="block text-base font-medium text-gray-900">{label}</span>
                {sublabel && <span className="block text-sm text-gray-900">{sublabel}</span>}
            </span>
            <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${
                    on ? "border-brand/90 bg-brand/90 text-white" : "border-gray-300 bg-white"
                }`}
            >
                {on && <Check size={16} strokeWidth={4} />}
            </span>
        </button>
    );
}

/** Each app's level, one line each; the chosen level says what it means. */
function AppLevels({ change, set, disabled }: Parameters<Fields>[0]) {
    const t = useT();
    return (
        <div className="space-y-3">
            {(["seller", "backoffice"] as const).map((app) => (
                <section key={app} className="space-y-1.5">
                    <PanelLabel>{t(app === "seller" ? "uac.seller" : "uac.office")}</PanelLabel>
                    <Segmented
                        value={change.access[app]}
                        disabled={disabled}
                        onChange={(level) => set({ access: { ...change.access, [app]: level } })}
                        choices={LEVELS[app].map((level) => ({
                            value: level as string,
                            label: t(`uac.${level || "none"}` as MessageKey),
                        }))}
                    />
                    <p className="px-1 text-xs text-gray-900">{t(HINTS[change.access[app]]!)}</p>
                </section>
            ))}
        </div>
    );
}

/** The tenant's stores by type, ticked. */
function StoreChecks({ change, set, disabled }: Parameters<Fields>[0]) {
    const t = useT();
    const stores = useTenant()?.tenant.stores ?? [];
    return (
        <div className="space-y-3">
            {storeGroups(stores).map((g) => (
                <section key={g.key} className="space-y-1.5">
                    <PanelLabel>
                        {t(g.key)} ({g.stores.filter((s) => change.storeIds.includes(s.id)).length}/
                        {g.stores.length})
                    </PanelLabel>
                    <div className="bg-slate-100 rounded-xl px-4 py-1">
                        {g.stores.map((s) => (
                            <CheckRow
                                key={s.id}
                                label={s.name}
                                disabled={disabled}
                                on={change.storeIds.includes(s.id)}
                                onToggle={() => set({ storeIds: toggled(change.storeIds, s.id) })}
                            />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

/** The level in each app and the stores, for a request. */
export function AccessFields(props: Parameters<Fields>[0]) {
    const t = useT();
    return (
        <>
            <Panel title={t("uac.apps")}>
                <AppLevels {...props} />
            </Panel>
            <Panel title={t("uac.stores")}>
                <StoreChecks {...props} />
            </Panel>
        </>
    );
}
