import { api } from "@tea-pos/api-client";
import { ME_KEY, useMe, type Me } from "@tea-pos/api-client/me";
import { formatLongDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { CopyButton } from "@tea-pos/ui/CopyButton";
import { DetailList, DetailRow as Row } from "@tea-pos/ui/DetailList";
import { Field } from "@tea-pos/ui/form/Field";
import { TextInput } from "@tea-pos/ui/form/TextInput";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { FormFooter } from "../frame/FormFooter";
import { HeaderActions } from "../frame/HeaderActions";
import { useApiMutation } from "../session/useApiMutation";

/** The old seller app's Personal Details: who the account is; Edit changes the name and phone. */
export function PersonalDetailsScreen() {
    const t = useT();
    const locale = useLocale();
    const user = useMe().data?.user;
    const [editing, setEditing] = useState(false);
    if (!user)
        return (
            <div className="bg-white rounded-xl px-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="py-4 space-y-2">
                        <Skeleton delay={i * 80} className="h-3 w-20 rounded" />
                        <Skeleton delay={i * 80} className="h-5 w-40 rounded" />
                    </div>
                ))}
            </div>
        );
    if (editing) return <DetailsForm user={user} onDone={() => setEditing(false)} />;
    const [first = "—", ...rest] = user.fullName.trim().split(" ");
    const shortId = user.id.slice(0, 13).toUpperCase();
    return (
        <DetailList>
            <HeaderActions
                actions={[{ kind: "edit", own: true, onClick: () => setEditing(true) }]}
            />
            <Row label={t("account.email")}>{user.email}</Row>
            <Row label={t("account.userId")}>
                <CopyButton
                    value={shortId}
                    size={18}
                    className="w-full flex items-center justify-between gap-3 active:opacity-70"
                >
                    {shortId}
                </CopyButton>
            </Row>
            <Row label={t("account.firstName")}>{first}</Row>
            <Row label={t("account.lastName")}>{rest.join(" ") || "—"}</Row>
            <Row label={t("account.phoneNumber")}>{user.phone || "—"}</Row>
            <Row label={t("account.memberSince")}>
                {user.since ? formatLongDate(user.since, locale) : "—"}
            </Row>
        </DetailList>
    );
}

function DetailsForm({ user, onDone }: { user: Me["user"]; onDone: () => void }) {
    const t = useT();
    const queryClient = useQueryClient();
    const [firstSaved = "", ...rest] = user.fullName.trim().split(" ");
    const [first, setFirst] = useState(firstSaved);
    const [last, setLast] = useState(rest.join(" "));
    const [phone, setPhone] = useState(user.phone ?? "");
    const fullName = `${first.trim()} ${last.trim()}`.trim();
    const save = useApiMutation<unknown, { fullName: string; phone: string }>(
        async (body) => {
            const res = await api.PATCH("/me", { body });
            if (res.error) throw res.error;
            return null;
        },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: ME_KEY }) },
    );
    return (
        <div className="space-y-4">
            <Field label={t("account.firstName")} required>
                <TextInput value={first} onChange={setFirst} />
            </Field>
            <Field label={t("account.lastName")}>
                <TextInput value={last} onChange={setLast} />
            </Field>
            <Field label={t("account.phoneNumber")}>
                <TextInput value={phone} onChange={setPhone} inputMode="tel" />
            </Field>
            <FormFooter
                label={t("common.save")}
                busyLabel={t("account.saving")}
                disabled={
                    !first.trim() ||
                    (fullName === user.fullName.trim() && phone === (user.phone ?? ""))
                }
                confirmTitle={t("account.confirmSave")}
                note={{ title: t("account.confirmSave"), body: t("account.confirmSaveBody") }}
                onSubmit={async () => {
                    await save.mutateAsync({ fullName, phone });
                    onDone();
                }}
            />
        </div>
    );
}
