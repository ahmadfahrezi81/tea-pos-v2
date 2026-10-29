import type { components } from "@tea-pos/api-client";
import { formatMoney } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import { FormFooter } from "@tea-pos/shell/FormFooter";
import { useAccess } from "@tea-pos/shell/tenant";
import { ListCard, ListRow, ListRowSkeleton } from "@tea-pos/ui/ListRow";
import { SearchBox as UiSearchBox } from "@tea-pos/ui/SearchBox";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Check, Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useCommissionTypes, usePayStaff, usePayWrite, useSlug, writes } from "./pay";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { ICON } from "@tea-pos/ui/icon";

type Staff = components["schemas"]["PayStaff"];

// Only the account states worth interrupting for; active is every row's assumption.
const STATUS_TAG: Record<string, string> = {
    suspended: "bg-red-100 text-red-600",
    inactive: "bg-gray-100 text-gray-500",
    pending: "bg-amber-100 text-amber-700",
};

/** The search box above a staff list, as the old app's. */
export function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const t = useT();
    return (
        <UiSearchBox
            value={value}
            onChange={onChange}
            placeholder={t("pay.searchStaff")}
            clearLabel={t("common.close")}
        />
    );
}

/** Staff but admins, searchable; what a row says and where it goes is the screen's. */
function StaffList({
    to,
    subtitle,
    tag,
}: {
    to: (id: string) => string;
    subtitle: (s: Staff) => ReactNode;
    tag?: (s: Staff) => ReactNode;
}) {
    const t = useT();
    const navigate = useNavigate();
    const { data } = usePayStaff();
    const [search, setSearch] = useState("");
    const staff = (data?.staff ?? []).filter((s) => s.role !== "ADMIN");
    const shown = search.trim()
        ? staff.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
        : staff;
    return (
        <div className="space-y-3">
            <SearchBox value={search} onChange={setSearch} />
            <ListCard>
                {!data ? (
                    [1, 2, 3].map((i) => <ListRowSkeleton key={i} withLeading />)
                ) : shown.length === 0 ? (
                    <p className="py-4 text-sm text-gray-400">
                        {t(search ? "pay.noStaffMatch" : "pay.noStaff")}
                    </p>
                ) : (
                    shown.map((s) => (
                        <ListRow
                            key={s.id}
                            onClick={() => void navigate({ to: to(s.id) })}
                            leading={<Avatar url={s.avatarUrl} square />}
                            title={
                                <span className="flex items-center gap-1.5 min-w-0">
                                    <span className="truncate">{s.name}</span>
                                    {tag?.(s)}
                                </span>
                            }
                            subtitle={subtitle(s)}
                        />
                    ))
                )}
            </ListCard>
        </div>
    );
}

/** Staff Payroll Info: each person's role and commission type. */
export function StaffInfoList() {
    const t = useT();
    const slug = useSlug();
    return (
        <StaffList
            to={(id) => `/${slug}/pay/settings/staff/${id}`}
            tag={(s) =>
                STATUS_TAG[s.status] && (
                    <span
                        className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${STATUS_TAG[s.status]}`}
                    >
                        {t(`pay.status.${s.status}` as MessageKey)}
                    </span>
                )
            }
            subtitle={(s) => (
                <>
                    {t(`home.roles.${s.role}` as MessageKey)}
                    {s.commissionType && (
                        <span className="ml-1.5 font-mono text-xs text-brand/70">
                            · {s.commissionType.slug}
                        </span>
                    )}
                </>
            )}
        />
    );
}

function Person({ s }: { s: Staff }) {
    return (
        <div className="bg-white rounded-xl p-4 flex items-center gap-4">
            <Avatar url={s.avatarUrl} size={56} square />
            <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-lg font-semibold text-gray-900 truncate">{s.name}</p>
                <p className="text-sm text-gray-400 truncate">{s.email}</p>
            </div>
        </div>
    );
}

const Heading = ({ children }: { children: ReactNode }) => (
    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-1">{children}</p>
);

function useStaffMember(id: string) {
    const { data } = usePayStaff();
    return { loaded: !!data, staff: data?.staff.find((s) => s.id === id) };
}

/** One person's pay info, read-only: the commission type (changed in Staff Commissions) and bank details. */
export function StaffInfo({ id }: { id: string }) {
    const t = useT();
    const slug = useSlug();
    const { loaded, staff } = useStaffMember(id);
    if (!loaded) return <Skeleton className="h-40 rounded-xl" />;
    if (!staff) return <p className="p-4 text-sm text-gray-400">{t("pay.staffNotFound")}</p>;
    const type = staff.commissionType;
    const bank = staff.bank;
    const line = (label: string, value: string | undefined, mono = false, last = false) =>
        value && (
            <div className={`py-3.5 ${last ? "" : "border-b border-gray-100"}`}>
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className={`text-base font-medium text-gray-900 ${mono ? "font-mono" : ""}`}>
                    {value}
                </p>
            </div>
        );
    return (
        <div className="space-y-4">
            <Person s={staff} />
            <div className="space-y-2">
                <Heading>{t("pay.commissionType")}</Heading>
                <div className="bg-white rounded-xl px-4 py-3.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-gray-900 truncate">
                            {type ? type.name : t("pay.none")}
                        </p>
                        <p className="text-sm text-gray-400 font-mono">
                            {type
                                ? t("pay.perCup").replace("{rate}", formatMoney(type.ratePerCup))
                                : t("pay.noCommission")}
                        </p>
                    </div>
                    <Link
                        to="/$tenant/pay/settings/staff-commissions/$userId"
                        params={{ tenant: slug, userId: id }}
                        className="flex items-center gap-1.5 text-sm font-medium text-brand px-2 py-1 rounded-lg active:bg-brand/10 shrink-0"
                    >
                        <Pencil size={14} />
                        {t("pay.change")}
                    </Link>
                </div>
            </div>
            <div className="space-y-2">
                <Heading>{t("pay.bankDetails")}</Heading>
                <div className="bg-white rounded-xl px-4">
                    {bank.name || bank.accountNumber ? (
                        <>
                            {line(t("pay.bank"), bank.name)}
                            {line(t("pay.accountNumber"), bank.accountNumber, true)}
                            {line(t("pay.accountHolder"), bank.accountHolder, false, true)}
                        </>
                    ) : (
                        <p className="py-4 text-sm text-gray-400">{t("pay.noBank")}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

/** Staff Commissions: each person and the commission type they are paid by. */
export function StaffCommissionList() {
    const t = useT();
    const slug = useSlug();
    return (
        <StaffList
            to={(id) => `/${slug}/pay/settings/staff-commissions/${id}`}
            subtitle={(s) =>
                s.commissionType ? (
                    s.commissionType.name
                ) : (
                    <span className="text-gray-300">{t("pay.noCommission")}</span>
                )
            }
        />
    );
}

/** Picks one person's commission type (an enabled one, or none). */
export function StaffCommission({ id }: { id: string }) {
    const t = useT();
    const router = useRouter();
    const { loaded, staff } = useStaffMember(id);
    const { data: types } = useCommissionTypes();
    // undefined: untouched (what is stored shows); null: a deliberate None.
    const [picked, setPicked] = useState<string | null | undefined>(undefined);
    const save = usePayWrite(writes.setStaffCommission);
    const { canWrite } = useAccess();
    if (!loaded || !types) return <Skeleton className="h-40 rounded-xl" />;
    if (!staff) return <p className="p-4 text-sm text-gray-400">{t("pay.staffNotFound")}</p>;
    const selected = picked !== undefined ? picked : (staff.commissionType?.id ?? null);
    const option = (key: string | null, title: string, sub: string, mono = false) => (
        <button
            key={key ?? "none"}
            onClick={() => setPicked(key)}
            className="w-full bg-white rounded-xl px-4 py-3 flex items-center justify-between active:bg-gray-50"
        >
            <div className="text-left">
                <p className="text-base font-medium text-gray-900">{title}</p>
                <p className={`text-sm text-gray-400 ${mono ? "font-mono" : ""}`}>{sub}</p>
            </div>
            {selected === key && <Check size={ICON} className="text-brand shrink-0" />}
        </button>
    );
    const enabled = types.types.filter((ty) => ty.enabled);
    return (
        <div className="space-y-4">
            <Person s={staff} />
            <div className="space-y-2">
                <Heading>{t("pay.commissionType")}</Heading>
                {option(null, t("pay.none"), t("pay.noCommission"))}
                {enabled.length === 0 ? (
                    <p className="text-sm text-gray-400 px-1">{t("pay.noCommissionTypes")}</p>
                ) : (
                    enabled.map((ty) =>
                        option(
                            ty.id,
                            ty.name,
                            t("pay.perCup").replace("{rate}", formatMoney(ty.ratePerCup)),
                            true,
                        ),
                    )
                )}
            </div>
            {canWrite && (
                <FormFooter
                    label={t("pay.saveChanges")}
                    busyLabel={t("pay.saving")}
                    confirmTitle={t("pay.confirmStaffCommission")}
                    confirmMessage={t("pay.confirmStaffCommissionSub")}
                    onSubmit={async () => {
                        await save.mutateAsync({ userId: id, commissionTypeId: selected });
                        router.history.back();
                    }}
                />
            )}
        </div>
    );
}
