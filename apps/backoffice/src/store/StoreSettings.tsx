import { $api, api, type components } from "@tea-pos/api-client";
import { STALE } from "@tea-pos/api-client/query";
import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { ConfirmSheet, FormFooter } from "@tea-pos/shell/FormFooter";
import { HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { useAccess, useSlug } from "@tea-pos/shell/tenant";
import { useApiMutation } from "@tea-pos/shell/useApiMutation";
import { Badge } from "@tea-pos/ui/Badge";
import { ChoiceList } from "@tea-pos/ui/ChoiceList";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { Field } from "@tea-pos/ui/form/Field";
import { TextInput } from "@tea-pos/ui/form/TextInput";
import { ListCard, ListRow, ListRowSkeleton } from "@tea-pos/ui/ListRow";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { toast } from "@tea-pos/ui/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";

type Store = components["schemas"]["StoreSettings"];
type Change = components["schemas"]["StoreChange"];
type Status = Store["status"];

const STATUSES: { value: Status; label: MessageKey; hint: MessageKey }[] = [
    { value: "active", label: "storeSettings.active", hint: "storeSettings.activeHint" },
    { value: "fake", label: "storeSettings.demo", hint: "storeSettings.demoHint" },
    { value: "inactive", label: "storeSettings.inactive", hint: "storeSettings.inactiveHint" },
];
const LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label])) as Record<
    Status,
    MessageKey
>;

const listPath = "/tenants/{tenant}/store-settings";
const onePath = "/tenants/{tenant}/store-settings/{storeId}";

function useStores() {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        listPath,
        { params: { path: { tenant } } },
        { enabled: !!tenant, staleTime: STALE.QUICK, meta: { live: ["stores"] } },
    );
}

function useStore(storeId: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        onePath,
        { params: { path: { tenant, storeId } } },
        { enabled: !!tenant, staleTime: STALE.QUICK, meta: { live: ["stores"] } },
    );
}

/** After a write: the settings, and /me, whose stores every picker shows. */
function useRefetch() {
    const queryClient = useQueryClient();
    return () =>
        void queryClient.invalidateQueries({
            predicate: (q) =>
                String(q.queryKey[1] ?? "").includes("/store-settings") || q.queryKey[0] === "me",
        });
}

/** Store settings: every store, active, then demo, then inactive; a tap opens its details. */
export function StoreSettingsList() {
    const t = useT();
    const slug = useSlug();
    const navigate = useNavigate();
    const { data } = useStores();
    if (data?.stores.length === 0) return <EmptyState title={t("storeSettings.none")} />;
    return (
        <ListCard>
            {!data
                ? [1, 2, 3].map((i) => <ListRowSkeleton key={i} />)
                : data.stores.map((s) => (
                      <ListRow
                          key={s.id}
                          title={s.name}
                          subtitle={`${s.openTime} – ${s.closeTime}${s.address ? ` · ${s.address}` : ""}`}
                          onClick={() => void navigate({ to: `/${slug}/store/settings/${s.id}` })}
                          trailing={<Badge>{t(LABEL[s.status])}</Badge>}
                      />
                  ))}
        </ListCard>
    );
}

type Form = {
    name: string;
    address: string;
    openTime: string;
    closeTime: string;
    status: Status;
    latitude: string;
    longitude: string;
};

const toForm = (s?: Store): Form => ({
    name: s?.name ?? "",
    address: s?.address ?? "",
    openTime: s?.openTime ?? "08:00",
    closeTime: s?.closeTime ?? "22:00",
    status: s?.status ?? "active",
    latitude: s?.latitude?.toString() ?? "",
    longitude: s?.longitude?.toString() ?? "",
});

/** A coordinate typed in, or undefined when left empty; NaN when it is not a number. */
const coordinate = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")));

function toChange(f: Form): Change | null {
    const latitude = coordinate(f.latitude);
    const longitude = coordinate(f.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
    return {
        name: f.name.trim(),
        address: f.address.trim(),
        openTime: f.openTime,
        closeTime: f.closeTime,
        status: f.status,
        latitude,
        longitude,
    };
}

function Fields({
    form,
    set,
    disabled,
}: {
    form: Form;
    set: (f: Form) => void;
    disabled: boolean;
}) {
    const t = useT();
    const field = (key: keyof Form) => (v: string) => set({ ...form, [key]: v });
    return (
        <div className="bg-white rounded-2xl p-3 space-y-3">
            <Field label={t("storeSettings.name")} required>
                <TextInput value={form.name} onChange={field("name")} />
            </Field>
            <Field label={t("storeSettings.address")}>
                <TextInput value={form.address} onChange={field("address")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label={t("storeSettings.opens")} required>
                    <TextInput type="time" value={form.openTime} onChange={field("openTime")} />
                </Field>
                <Field label={t("storeSettings.closes")} required>
                    <TextInput type="time" value={form.closeTime} onChange={field("closeTime")} />
                </Field>
            </div>
            <Field label={t("storeSettings.status")} required>
                <ChoiceList
                    value={form.status}
                    onChange={(v) => set({ ...form, status: v as Status })}
                    choices={STATUSES.map((s) => ({
                        value: s.value,
                        label: t(s.label),
                        sublabel: t(s.hint),
                        disabled,
                    }))}
                />
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label={t("storeSettings.latitude")}>
                    <TextInput
                        value={form.latitude}
                        onChange={field("latitude")}
                        inputMode="decimal"
                        placeholder="-6.2088"
                    />
                </Field>
                <Field label={t("storeSettings.longitude")}>
                    <TextInput
                        value={form.longitude}
                        onChange={field("longitude")}
                        inputMode="decimal"
                        placeholder="106.8456"
                    />
                </Field>
            </div>
        </div>
    );
}

/** One store's details; Save asks first, and Delete only removes a store with nothing recorded. */
export function StoreSettingsEdit({ storeId }: { storeId: string }) {
    const t = useT();
    const tenant = useSlug();
    const router = useRouter();
    const refetch = useRefetch();
    const { canWrite } = useAccess();
    const { data } = useStore(storeId);
    const [form, setForm] = useState<(Form & { id: string }) | null>(null);
    // Seeded during render once the store arrives, so the form never paints empty first.
    if (data && form?.id !== data.id) setForm({ id: data.id, ...toForm(data) });
    const [asking, setAsking] = useState(false);
    const save = useApiMutation<unknown, Change>(
        async (body, headers) => {
            const res = await api.PUT(onePath, {
                params: { path: { tenant, storeId } },
                body,
                headers,
            });
            if (res.error) throw res.error;
            return res.data;
        },
        { onSuccess: refetch },
    );
    const remove = useApiMutation<unknown, object>(
        async () => {
            const res = await api.DELETE(onePath, { params: { path: { tenant, storeId } } });
            if (res.error) throw res.error;
            return null;
        },
        { onSuccess: refetch },
    );
    if (!data || !form) return <Skeleton className="h-96 rounded-2xl" />;
    const change = toChange(form);
    const changed = (Object.keys(form) as (keyof Form | "id")[]).some(
        (k) => k !== "id" && form[k] !== toForm(data)[k],
    );
    return (
        <div className="space-y-4">
            <HeaderTitle>{data.name}</HeaderTitle>
            <Fields form={form} set={(f) => setForm({ ...f, id: data.id })} disabled={!canWrite} />
            {canWrite && (
                <div className="flex justify-center">
                    <button
                        onClick={() => setAsking(true)}
                        className="px-4 py-2 text-sm font-semibold text-red-600 active:opacity-60"
                    >
                        {t("storeSettings.delete")}
                    </button>
                </div>
            )}
            {canWrite && (
                <FormFooter
                    label={t("storeSettings.save")}
                    busyLabel={t("storeSettings.saving")}
                    disabled={!changed || !change || !form.name.trim()}
                    confirmTitle={t("storeSettings.confirmSave").replace(
                        "{name}",
                        form.name.trim(),
                    )}
                    confirmMessage={t("storeSettings.confirmSaveBody")}
                    note={{
                        title: t("storeSettings.noteTitle"),
                        body: t("storeSettings.noteBody"),
                    }}
                    onSubmit={async () => {
                        if (!change) return false;
                        await save.mutateAsync(change);
                        router.history.back();
                    }}
                />
            )}
            <ConfirmSheet
                open={asking}
                title={t("storeSettings.deleteTitle").replace("{name}", data.name)}
                message={t("storeSettings.deleteBody")}
                label={t("storeSettings.delete")}
                busyLabel={t("storeSettings.saving")}
                tone="orange"
                onConfirm={async () => {
                    await remove.mutateAsync({});
                    setAsking(false);
                    toast(t("storeSettings.deleted").replace("{name}", data.name), {
                        kind: "success",
                    });
                    router.history.back();
                }}
                onError={() => setAsking(false)}
                onCancel={() => setAsking(false)}
            />
        </div>
    );
}

/** A new store, with the same fields; who works there is set in UAC. */
export function StoreSettingsAdd() {
    const t = useT();
    const tenant = useSlug();
    const router = useRouter();
    const refetch = useRefetch();
    const [form, setForm] = useState<Form>(toForm());
    const create = useApiMutation<unknown, Change>(
        async (body, headers) => {
            const res = await api.POST(listPath, { params: { path: { tenant } }, body, headers });
            if (res.error) throw res.error;
            return res.data;
        },
        { onSuccess: refetch },
    );
    const change = toChange(form);
    return (
        <div className="space-y-4">
            <Fields form={form} set={setForm} disabled={false} />
            <FormFooter
                label={t("storeSettings.create")}
                busyLabel={t("storeSettings.saving")}
                disabled={!change || !form.name.trim()}
                confirmTitle={t("storeSettings.confirmCreate").replace("{name}", form.name.trim())}
                confirmMessage={t("storeSettings.confirmCreateBody")}
                note={{ title: t("storeSettings.noteTitle"), body: t("storeSettings.noteBody") }}
                onSubmit={async () => {
                    if (!change) return false;
                    await create.mutateAsync(change);
                    router.history.back();
                }}
            />
        </div>
    );
}
