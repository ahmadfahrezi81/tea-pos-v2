import type { MessageKey } from "@tea-pos/i18n";
import { formatLongDate, formatMoney } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import { Callout } from "@tea-pos/ui/Callout";
import { ChoiceList } from "@tea-pos/ui/ChoiceList";
import { Field } from "@tea-pos/ui/form/Field";
import { Segmented } from "@tea-pos/ui/form/Segmented";
import { Switch } from "@tea-pos/ui/form/Switch";
import { TextInput } from "@tea-pos/ui/form/TextInput";
import { Panel, PanelLabel } from "@tea-pos/ui/Panel";
import { InfoList, InfoRow } from "@tea-pos/ui/DetailList";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { toast } from "@tea-pos/ui/toast";
import { useMe } from "@tea-pos/api-client/me";
import { ConfirmSheet, FormFooter } from "@tea-pos/shell/FormFooter";
import { HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { LogOutButton, rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { useAccess, useSlug, useTenant } from "@tea-pos/shell/tenant";
import { useRouter } from "@tanstack/react-router";
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

import { useClaimTypes, useCommissionTypes, usePayWrite, writes } from "../pay/pay";
import {
    storeGroups,
    useLogoutPerson,
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

type Part = "details" | "apps" | "stores" | "commission" | "claims";

/** A person, everything at a glance: each row opens its own page, whose save asks first. */
export function PersonPage({ userId }: { userId: string }) {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const { canWrite, owner } = useAccess();
    const stores = useTenant()?.tenant.stores ?? [];
    const { data: p } = useUacPerson(userId);
    const { data: claimTypes } = useClaimTypes();
    const self = useMe().data?.user.id === userId;
    if (!p) return <Skeleton className="h-60 rounded-2xl" />;
    const bank = p.bank;
    // The owner keeps full access, and someone turned off has none to change.
    const access = canWrite && !p.owner && p.active;
    // Their stores are for the owner alone to change.
    const storesOpen = canWrite && p.active && (!p.owner || owner);
    const level = (app: "seller" | "backoffice") =>
        `${t(app === "seller" ? "uac.seller" : "uac.office")}: ${t(`uac.${p.access[app] || "none"}` as MessageKey)}`;
    const row = (
        part: Part,
        icon: ReactNode,
        label: string,
        sublabel: string,
        editable: boolean,
    ) => (
        <SettingsRow
            icon={icon}
            label={label}
            sublabel={sublabel}
            to={editable ? `/${slug}/uac/${p.id}/${part}` : undefined}
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
                    {p.since && <p className="truncate">{formatLongDate(p.since, locale)}</p>}
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
                    storesOpen,
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

            <section className="space-y-2">
                <SectionLabel>{t("pay.bankDetails")}</SectionLabel>
                <InfoList>
                    {bank?.name || bank?.accountNumber ? (
                        <>
                            {bank.name && <InfoRow label={t("pay.bank")}>{bank.name}</InfoRow>}
                            {bank.accountNumber && (
                                <InfoRow label={t("pay.accountNumber")}>
                                    <span className="font-mono">{bank.accountNumber}</span>
                                </InfoRow>
                            )}
                            {bank.accountHolder && (
                                <InfoRow label={t("pay.accountHolder")}>
                                    {bank.accountHolder}
                                </InfoRow>
                            )}
                        </>
                    ) : (
                        <InfoRow label={t("pay.bankDetails")}>{t("pay.noBank")}</InfoRow>
                    )}
                </InfoList>
            </section>

            {canWrite && !self && (!p.owner || owner) && <LogoutRow person={p} />}
        </div>
    );
}

/** One of a person's settings on its own page; saved only after the footer's sheet says yes. */
export function PersonSetting({ userId, part }: { userId: string; part: Part }) {
    const { data } = useUacPerson(userId);
    const { canWrite, owner } = useAccess();
    if (!data) return <Skeleton className="h-60 rounded-2xl" />;
    // Keyed by what was saved, so a change from elsewhere starts the form again.
    const key = JSON.stringify(data);
    if (part === "details") return <DetailsForm key={key} person={data} canWrite={canWrite} />;
    if (part === "commission")
        return <CommissionForm key={key} person={data} canWrite={canWrite} />;
    if (part === "claims") return <ClaimsForm key={key} person={data} canWrite={canWrite} />;
    return (
        <ChangeForm
            key={key}
            person={data}
            fields={part === "apps" ? AppLevels : StoreChecks}
            canWrite={canWrite && data.active && (!data.owner || (part === "stores" && owner))}
        />
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

/** Signs them out everywhere, for a lost phone; they can sign in again unless turned off too. */
function LogoutRow({ person: p }: { person: Person }) {
    const t = useT();
    const logout = useLogoutPerson(p.id);
    const [asking, setAsking] = useState(false);
    return (
        <div className="flex justify-center pt-4">
            <LogOutButton label={t("common.logout")} onClick={() => setAsking(true)} />
            <ConfirmSheet
                open={asking}
                title={t("uac.logoutTitle").replace("{name}", p.name)}
                message={t("uac.logoutBody")}
                label={t("common.logout")}
                busyLabel={t("uac.saving")}
                tone="orange"
                onConfirm={async () => {
                    await logout.mutateAsync({});
                    setAsking(false);
                    toast(t("uac.loggedOut").replace("{name}", p.name));
                }}
                onError={() => setAsking(false)}
                onCancel={() => setAsking(false)}
            />
        </div>
    );
}

/** A setting's save in the footer, with its confirm sheet; then back to the person. */
function Save({
    person: p,
    changed,
    onSave,
    access = false,
}: {
    person: Person;
    changed: boolean;
    onSave: () => Promise<unknown>;
    /** Says it applies at once, not the pay settings' "from now on". */
    access?: boolean;
}) {
    const t = useT();
    const router = useRouter();
    return (
        <FormFooter
            label={t("uac.save")}
            busyLabel={t("uac.saving")}
            disabled={!changed}
            confirmTitle={t("uac.confirmTitle").replace("{name}", p.name)}
            note={access ? { title: t("uac.noteTitle"), body: t("uac.confirmBody") } : undefined}
            onSubmit={async () => {
                await onSave();
                router.history.back();
            }}
        />
    );
}

type FormProps = { person: Person; canWrite: boolean };

function DetailsForm({ person: p, canWrite }: FormProps) {
    const t = useT();
    const save = useSetDetails(p.id);
    const [fullName, setName] = useState(p.name);
    const [phone, setPhone] = useState(p.phone ?? "");
    return (
        <>
            <Panel>
                <Field label={t("pay.name")} required>
                    <TextInput value={fullName} onChange={setName} />
                </Field>
                <Field label={t("account.phoneNumber")}>
                    <TextInput value={phone} onChange={setPhone} inputMode="tel" />
                </Field>
            </Panel>
            {canWrite && (
                <Save
                    person={p}
                    access
                    changed={
                        !!fullName.trim() &&
                        (fullName.trim() !== p.name || phone.trim() !== (p.phone ?? ""))
                    }
                    onSave={() => save.mutateAsync({ fullName, phone })}
                />
            )}
        </>
    );
}

type Fields = (props: {
    change: Change;
    set: (next: Partial<Change>) => void;
    disabled: boolean;
}) => ReactNode;

/** Apps or stores: the rest of what the save sends stays as it is. */
function ChangeForm({ person: p, fields: Fields, canWrite }: FormProps & { fields: Fields }) {
    const save = useSetPerson(p.id);
    const saved: Change = { access: p.access, storeIds: p.storeIds, active: p.active };
    const [change, setChange] = useState<Change>(saved);
    return (
        <>
            <Panel>
                <Fields
                    change={change}
                    set={(next) => setChange((c) => ({ ...c, ...next }))}
                    disabled={!canWrite}
                />
            </Panel>
            {canWrite && (
                <Save
                    person={p}
                    access
                    changed={JSON.stringify(change) !== JSON.stringify(saved)}
                    onSave={() => save.mutateAsync(change)}
                />
            )}
        </>
    );
}

function CommissionForm({ person: p, canWrite }: FormProps) {
    const t = useT();
    const { data } = useCommissionTypes();
    const save = usePayWrite(writes.setStaffCommission);
    const [picked, setPicked] = useState(p.commissionTypeId ?? "");
    if (!data) return <Skeleton className="h-40 rounded-xl" />;
    return (
        <>
            <ChoiceList
                value={picked}
                onChange={setPicked}
                choices={[
                    {
                        value: "",
                        label: t("pay.none"),
                        sublabel: t("pay.noCommission"),
                        disabled: !canWrite,
                    },
                    ...data.types
                        .filter((c) => c.enabled)
                        .map((c) => ({
                            value: c.id,
                            label: c.name,
                            sublabel: t("pay.perCup").replace("{rate}", formatMoney(c.ratePerCup)),
                            disabled: !canWrite,
                        })),
                ]}
            />
            {canWrite && (
                <Save
                    person={p}
                    changed={picked !== (p.commissionTypeId ?? "")}
                    onSave={() =>
                        save.mutateAsync({ userId: p.id, commissionTypeId: picked || null })
                    }
                />
            )}
        </>
    );
}

function ClaimsForm({ person: p, canWrite }: FormProps) {
    const t = useT();
    const { data } = useClaimTypes();
    const save = usePayWrite(writes.setStaffClaims);
    const [picked, setPicked] = useState(p.claimTypeIds);
    if (!data) return <Skeleton className="h-40 rounded-xl" />;
    const enabled = data.types.filter((c) => c.enabled);
    const same = (ids: string[]) => [...ids].sort().join();
    return (
        <>
            <Panel>
                <div className="bg-slate-100 rounded-xl px-4 py-1">
                    {enabled.length === 0 ? (
                        <p className="py-3 text-sm text-gray-900">{t("uac.noClaims")}</p>
                    ) : (
                        enabled.map((c) => (
                            <CheckRow
                                key={c.id}
                                label={c.name}
                                sublabel={formatMoney(c.amount)}
                                disabled={!canWrite}
                                on={picked.includes(c.id)}
                                onToggle={() => setPicked((ids) => toggled(ids, c.id))}
                            />
                        ))
                    )}
                </div>
            </Panel>
            {canWrite && (
                <Save
                    person={p}
                    changed={same(picked) !== same(p.claimTypeIds)}
                    onSave={() => save.mutateAsync({ userId: p.id, claimTypeIds: picked })}
                />
            )}
        </>
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
