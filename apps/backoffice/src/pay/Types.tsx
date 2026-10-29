import type { components } from "@tea-pos/api-client";
import { formatMoney } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { FormFooter } from "@tea-pos/shell/FormFooter";
import { useAccess, useSlug } from "@tea-pos/shell/tenant";
import { CopyButton } from "@tea-pos/ui/CopyButton";
import { Field } from "@tea-pos/ui/form/Field";
import { NumberInput } from "@tea-pos/ui/form/NumberInput";
import { Switch } from "@tea-pos/ui/form/Switch";
import { TextInput } from "@tea-pos/ui/form/TextInput";
import { ListCard, ListRow, ListRowSkeleton } from "@tea-pos/ui/ListRow";
import { toast } from "@tea-pos/ui/toast";
import { Link, useRouter } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";

import { SearchBox } from "./Staff";
import {
    useClaimEligible,
    useClaimTypes,
    useCommissionTypes,
    usePayStaff,
    usePayWrite,
    writes,
} from "./pay";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { ICON } from "@tea-pos/ui/icon";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";

type ClaimType = components["schemas"]["ClaimType"];
type Frequency = ClaimType["frequency"];
type Source = ClaimType["source"];

const FREQUENCIES: Frequency[] = ["daily", "weekly", "monthly", "one_time"];
const SOURCES: Source[] = ["manual", "auto_submit", "auto"];
/** A slug as the old app makes it: upper case, spaces as underscores. */
const slugify = (v: string) => v.toUpperCase().replace(/\s+/g, "_");

function Enabled({ on }: { on: boolean }) {
    return (
        <span
            className={`font-mono font-bold text-base uppercase ${on ? "text-green-500" : "text-gray-400"}`}
        >
            {on ? "TRUE" : "FALSE"}
        </span>
    );
}

function EditLink({ to }: { to: string }) {
    const t = useT();
    if (!useAccess().canWrite) return null;
    return (
        <Link to={to} className="p-2 -mr-2 text-brand active:opacity-70" aria-label={t("pay.edit")}>
            <Pencil size={ICON} strokeWidth={2} />
        </Link>
    );
}

function TypeList<T extends { id: string }>({
    items,
    empty,
    row,
}: {
    items: T[] | undefined;
    empty: string;
    row: (t: T) => ReactNode;
}) {
    return (
        <div className="space-y-3">
            {items?.length === 0 ? (
                <EmptyState title={empty} />
            ) : (
                <ListCard>
                    {!items ? [1, 2].map((i) => <ListRowSkeleton key={i} />) : items.map(row)}
                </ListCard>
            )}
        </div>
    );
}

export function CommissionTypeList() {
    const t = useT();
    const slug = useSlug();
    const { data } = useCommissionTypes();
    return (
        <TypeList
            items={data?.types}
            empty={t("pay.noCommissionTypesYet")}
            row={(ty) => (
                <ListRow
                    key={ty.id}
                    title={ty.name}
                    subtitle={<span className="font-mono">{ty.slug}</span>}
                    trailing={
                        <div className="flex items-center gap-3 shrink-0">
                            <Enabled on={ty.enabled} />
                            <EditLink to={`/${slug}/pay/settings/commission-types/${ty.id}/edit`} />
                        </div>
                    }
                />
            )}
        />
    );
}

/** The slug, fixed once made, with a copy button. */
function SlugField({ slug }: { slug: string }) {
    const t = useT();
    return (
        <Field label={t("pay.slug")}>
            <div className="flex items-center gap-2 p-4 px-3 border-2 border-gray-100 rounded-2xl bg-gray-50">
                <p className="flex-1 font-mono text-base text-gray-900">{slug}</p>
                <CopyButton
                    value={slug}
                    size={16}
                    label={t("pay.copySlug")}
                    className="p-1 active:scale-90"
                    onCopied={() => toast(t("pay.slugCopied"))}
                    onFailed={() => toast(t("pay.slugNotCopied"))}
                />
            </div>
        </Field>
    );
}

function ReadOnly({ value }: { value: string }) {
    return (
        <div className="p-4 px-3 border-2 border-gray-100 rounded-2xl bg-gray-50 text-base font-medium text-gray-900">
            {value}
        </div>
    );
}

const Card = ({ children }: { children: ReactNode }) => (
    <div className="bg-white rounded-xl p-4 space-y-4">{children}</div>
);
const ErrorLine = ({ text }: { text: string | null }) =>
    text ? <p className="text-sm text-red-500">{text}</p> : null;

export function CommissionTypeAdd() {
    const t = useT();
    const router = useRouter();
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [rate, setRate] = useState(0);
    const create = usePayWrite(writes.createCommissionType);
    return (
        <div className="space-y-4">
            <Card>
                <Field label={t("pay.name")} required>
                    <TextInput
                        value={name}
                        onChange={setName}
                        placeholder={t("pay.commissionNameHint")}
                        className="text-base font-medium"
                    />
                </Field>
                <Field label={t("pay.slugAuto")} required>
                    <TextInput
                        value={slug}
                        onChange={(v) => setSlug(slugify(v))}
                        placeholder="SELLER_STANDARD"
                        className="text-base font-medium"
                    />
                </Field>
                <Field label={t("pay.ratePerCup")}>
                    <NumberInput
                        value={rate || null}
                        onChange={(v) => setRate(v ?? 0)}
                        currency
                        prefix="Rp"
                    />
                </Field>
            </Card>
            <FormFooter
                label={t("pay.createCommissionType")}
                busyLabel={t("pay.creating")}
                disabled={!name.trim() || !slug.trim()}
                confirmTitle={t("pay.confirmCreateCommission")}
                confirmMessage={t("pay.confirmCreateCommissionSub")}
                onSubmit={async () => {
                    await create.mutateAsync({
                        name: name.trim(),
                        slug: slugify(slug.trim()),
                        ratePerCup: rate,
                    });
                    router.history.back();
                }}
            />
        </div>
    );
}

export function CommissionTypeEdit({ id }: { id: string }) {
    const t = useT();
    const router = useRouter();
    const { data } = useCommissionTypes();
    const type = data?.types.find((ty) => ty.id === id);
    const [form, setForm] = useState<{
        id: string;
        name: string;
        enabled: boolean;
        rate: number;
    } | null>(null);
    // Seeded during render once the type arrives, so the form never paints empty first.
    if (type && form?.id !== type.id)
        setForm({ id: type.id, name: type.name, enabled: type.enabled, rate: type.ratePerCup });
    const update = usePayWrite(writes.updateCommissionType);
    if (!data) return <Skeleton className="h-60 rounded-xl" />;
    if (!type || !form)
        return <p className="p-4 text-sm text-gray-900">{t("pay.commissionTypeNotFound")}</p>;
    return (
        <div className="space-y-4">
            <Card>
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">{t("pay.enabled")}</p>
                    <Switch
                        on={form.enabled}
                        onChange={(enabled) => setForm({ ...form, enabled })}
                        label={t("pay.enabled")}
                    />
                </div>
                <Field label={t("pay.name")} required>
                    <TextInput
                        value={form.name}
                        onChange={(name) => setForm({ ...form, name })}
                        className="text-base font-medium"
                    />
                </Field>
                <SlugField slug={type.slug} />
                <Field label={t("pay.ratePerCup")}>
                    <NumberInput
                        value={form.rate || null}
                        onChange={(v) => setForm({ ...form, rate: v ?? 0 })}
                        currency
                        prefix="Rp"
                    />
                </Field>
            </Card>
            <FormFooter
                label={t("pay.saveChanges")}
                busyLabel={t("pay.saving")}
                disabled={!form.name.trim()}
                confirmTitle={t("pay.confirmSaveCommission")}
                confirmMessage={t("pay.confirmSaveCommissionSub")}
                onSubmit={async () => {
                    await update.mutateAsync({
                        id,
                        name: form.name.trim(),
                        enabled: form.enabled,
                        ratePerCup: form.rate,
                    });
                    router.history.back();
                }}
            />
        </div>
    );
}

export function ClaimTypeList() {
    const t = useT();
    const slug = useSlug();
    const { data } = useClaimTypes();
    return (
        <TypeList
            items={data?.types}
            empty={t("pay.noClaimTypesYet")}
            row={(ty) => (
                <ListRow
                    key={ty.id}
                    title={ty.name}
                    subtitle={
                        <>
                            {t(`pay.frequency.${ty.frequency}` as MessageKey)}
                            {ty.source === "auto" && ` · ${t("pay.auto")}`}
                            {ty.source === "auto_submit" && ` · ${t("pay.autoSubmit")}`}
                        </>
                    }
                    trailing={
                        <div className="flex items-center gap-3 shrink-0">
                            <Enabled on={ty.enabled} />
                            <EditLink to={`/${slug}/pay/settings/claim-types/${ty.id}/edit`} />
                        </div>
                    }
                />
            )}
        />
    );
}

function Choice<T extends string>({
    options,
    value,
    onChange,
    label,
}: {
    options: T[];
    value: T;
    onChange: (v: T) => void;
    label: (v: T) => string;
}) {
    return (
        <div className="flex gap-2">
            {options.map((o) => (
                <button
                    key={o}
                    onClick={() => onChange(o)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${value === o ? "bg-brand text-white border-brand" : "border-gray-200 text-gray-600"}`}
                >
                    {label(o)}
                </button>
            ))}
        </div>
    );
}

export function ClaimTypeAdd() {
    const t = useT();
    const router = useRouter();
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [frequency, setFrequency] = useState<Frequency>("weekly");
    const [amount, setAmount] = useState(0);
    const [source, setSource] = useState<Source>("manual");
    const [hours, setHours] = useState(4);
    const [error, setError] = useState<string | null>(null);
    const create = usePayWrite(writes.createClaimType);
    const needsHours = source === "auto";
    return (
        <div className="space-y-4">
            <Card>
                <Field label={t("pay.name")} required>
                    <TextInput
                        value={name}
                        onChange={setName}
                        placeholder={t("pay.claimNameHint")}
                        className="text-base font-medium"
                    />
                </Field>
                <Field label={t("pay.slugAuto")} required>
                    <TextInput
                        value={slug}
                        onChange={(v) => setSlug(slugify(v))}
                        placeholder="LUNCH_ALLOWANCE"
                        className="text-base font-medium"
                    />
                </Field>
                <Field label={t("pay.amount")}>
                    <NumberInput
                        value={amount || null}
                        onChange={(v) => setAmount(v ?? 0)}
                        currency
                        prefix="Rp"
                    />
                </Field>
                <Field label={t("pay.frequencyLabel")}>
                    <Choice
                        options={FREQUENCIES}
                        value={frequency}
                        onChange={setFrequency}
                        label={(f) => t(`pay.frequency.${f}` as MessageKey)}
                    />
                </Field>
                <Field label={t("pay.decidedBy")}>
                    <Choice
                        options={SOURCES}
                        value={source}
                        onChange={setSource}
                        label={(s) => t(`pay.source.${s}` as MessageKey)}
                    />
                </Field>
                {source !== "manual" && (
                    <Field label={t("pay.minHours")} required={needsHours}>
                        <NumberInput
                            value={hours || null}
                            onChange={(v) => setHours(v ?? 0)}
                            unit={t("pay.hours")}
                            raw
                        />
                    </Field>
                )}
                <ErrorLine text={error} />
            </Card>
            <FormFooter
                label={t("pay.createClaimType")}
                busyLabel={t("pay.creating")}
                disabled={!name.trim() || !slug.trim() || (needsHours && hours <= 0)}
                confirmTitle={t("pay.confirmCreateClaim")}
                confirmMessage={t("pay.confirmCreateClaimSub")}
                onSubmit={async () => {
                    if (needsHours && hours <= 0) {
                        setError(t("pay.autoNeedsHours"));
                        return false;
                    }
                    await create.mutateAsync({
                        name: name.trim(),
                        slug: slugify(slug.trim()),
                        frequency,
                        amount,
                        source,
                        ...(source !== "manual" ? { autoThresholdHours: hours } : {}),
                    });
                    router.history.back();
                }}
            />
        </div>
    );
}

export function ClaimTypeEdit({ id }: { id: string }) {
    const t = useT();
    const router = useRouter();
    const { data } = useClaimTypes();
    const { data: staff } = usePayStaff();
    const { data: eligible } = useClaimEligible(id);
    const type = data?.types.find((ty) => ty.id === id);
    const [form, setForm] = useState<{ id: string; name: string; enabled: boolean } | null>(null);
    if (type && form?.id !== type.id)
        setForm({ id: type.id, name: type.name, enabled: type.enabled });
    // Toggled here, saved with the rest; undefined until the first toggle.
    const [picked, setPicked] = useState<Set<string> | undefined>(undefined);
    const [search, setSearch] = useState("");
    const update = usePayWrite(writes.updateClaimType);
    const setEligible = usePayWrite(writes.setClaimEligible);
    if (!data) return <Skeleton className="h-60 rounded-xl" />;
    if (!type || !form)
        return <p className="p-4 text-sm text-gray-900">{t("pay.claimTypeNotFound")}</p>;
    const current = picked ?? new Set(eligible?.userIds ?? []);
    const people = (staff?.staff ?? []).filter((s) => s.role !== "ADMIN");
    const shown = search.trim()
        ? people.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
        : people;
    const toggle = (userId: string) => {
        const next = new Set(current);
        if (!next.delete(userId)) next.add(userId);
        setPicked(next);
    };
    const decided =
        type.source === "auto"
            ? t("pay.decidedAuto").replace("{h}", String(type.autoThresholdHours ?? "?"))
            : type.source === "auto_submit"
              ? t("pay.decidedAutoSubmit")
              : t("pay.source.manual");
    return (
        <div className="space-y-4">
            <Card>
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">{t("pay.enabled")}</p>
                    <Switch
                        on={form.enabled}
                        onChange={(enabled) => setForm({ ...form, enabled })}
                        label={t("pay.enabled")}
                    />
                </div>
                <Field label={t("pay.name")} required>
                    <TextInput
                        value={form.name}
                        onChange={(name) => setForm({ ...form, name })}
                        className="text-base font-medium"
                    />
                </Field>
                <SlugField slug={type.slug} />
                <Field label={t("pay.amount")}>
                    <ReadOnly value={formatMoney(type.amount)} />
                </Field>
                <Field label={t("pay.decidedBy")}>
                    <ReadOnly value={decided} />
                </Field>
            </Card>
            <SearchBox value={search} onChange={setSearch} />
            <div className="space-y-2">
                <SectionLabel inset={false}>{t("pay.eligibility")}</SectionLabel>
                {shown.length === 0 ? (
                    <p className="text-sm text-gray-900 px-1">{t("pay.noStaff")}</p>
                ) : (
                    shown.map((s) => (
                        <div
                            key={s.id}
                            className="bg-white rounded-xl px-4 py-3 flex items-center justify-between"
                        >
                            <p className="text-base font-medium text-gray-900">{s.name}</p>
                            <Switch
                                on={current.has(s.id)}
                                onChange={() => eligible && toggle(s.id)}
                                label={s.name}
                            />
                        </div>
                    ))
                )}
            </div>
            <FormFooter
                label={t("pay.saveChanges")}
                busyLabel={t("pay.saving")}
                disabled={!form.name.trim()}
                confirmTitle={t("pay.confirmSaveClaim")}
                confirmMessage={t("pay.confirmSaveClaimSub")}
                onSubmit={async () => {
                    await update.mutateAsync({ id, name: form.name.trim(), enabled: form.enabled });
                    if (picked) await setEligible.mutateAsync({ id, userIds: [...picked] });
                    router.history.back();
                }}
            />
        </div>
    );
}
