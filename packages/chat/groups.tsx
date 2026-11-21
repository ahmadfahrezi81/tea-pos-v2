import { $api, api } from "@tea-pos/api-client";
import { useMe } from "@tea-pos/api-client/me";
import { STALE } from "@tea-pos/api-client/query";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useSlug, useTenant } from "@tea-pos/shell/tenant";
import { useApiMutation } from "@tea-pos/shell/useApiMutation";
import { ActionButton } from "@tea-pos/ui/ActionButton";
import { Avatar } from "@tea-pos/ui/Avatar";
import { TextInput } from "@tea-pos/ui/form/TextInput";
import { SearchBox } from "@tea-pos/ui/SearchBox";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";
import { Sheet } from "@tea-pos/ui/Sheet";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";

// Groups and Follow (task 070): made and run by chat admins.

/** A chat admin: makes groups, opens any channel, follows. */
export function useChatAdmin() {
    return useTenant()?.tenant.access.chat === "admin";
}

/** Everyone with a chat level, and (with a group) who is in it. */
export function useChatPeople(group?: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/chat/people",
        { params: { path: { tenant }, query: group ? { group } : {} } },
        { enabled: !!tenant, staleTime: STALE.QUICK, meta: { live: ["chat"] } },
    );
}

/** After a group or follow change: every chat query reads again. */
function useRefetchChat() {
    const queryClient = useQueryClient();
    return () =>
        void queryClient.invalidateQueries({
            predicate: (q) =>
                String(q.queryKey[1] ?? "").includes("/chat/") || q.queryKey[0] === "chat-messages",
        });
}

export function useCreateGroup() {
    const tenant = useSlug();
    const refetch = useRefetchChat();
    return useApiMutation(
        async (body: { name: string; members: string[] }, headers) => {
            const { data, error } = await api.POST("/tenants/{tenant}/chat/groups", {
                params: { path: { tenant } },
                body,
                headers,
            });
            if (error) throw error;
            return data;
        },
        { onSuccess: refetch },
    );
}

export function useUpdateGroup(id: string) {
    const tenant = useSlug();
    const refetch = useRefetchChat();
    return useApiMutation(
        async (body: { name?: string; archived?: boolean }, headers) => {
            const { error } = await api.PATCH("/tenants/{tenant}/chat/groups/{id}", {
                params: { path: { tenant, id } },
                body,
                headers,
            });
            if (error) throw error;
        },
        { onSuccess: refetch },
    );
}

export function useSetGroupMembers(id: string) {
    const tenant = useSlug();
    const refetch = useRefetchChat();
    return useApiMutation(
        async (body: { members: string[] }, headers) => {
            const { error } = await api.PUT("/tenants/{tenant}/chat/groups/{id}/members", {
                params: { path: { tenant, id } },
                body,
                headers,
            });
            if (error) throw error;
        },
        { onSuccess: refetch },
    );
}

export function useFollow(id: string) {
    const tenant = useSlug();
    const refetch = useRefetchChat();
    return useApiMutation(
        async ({ on }: { on: boolean }, headers) => {
            const opts = { params: { path: { tenant, id } }, headers };
            const { error } = on
                ? await api.PUT("/tenants/{tenant}/chat/channels/{id}/follow", opts)
                : await api.DELETE("/tenants/{tenant}/chat/channels/{id}/follow", opts);
            if (error) throw error;
        },
        { onSuccess: refetch },
    );
}

/** The tenant's chat people, ticked; searchable once the list is long. */
export function PeoplePicker({
    picked,
    onChange,
    group,
}: {
    picked: string[] | null;
    onChange: (ids: string[]) => void;
    /** Start from who is in this group. */
    group?: string;
}) {
    const t = useT();
    const locale = useLocale();
    const { data } = useChatPeople(group);
    const [search, setSearch] = useState("");
    if (!data) return <Skeleton className="h-40 rounded-2xl" />;
    const ids = picked ?? data.people.filter((p) => p.in).map((p) => p.id);
    const q = search.trim().toLowerCase();
    const people = [...data.people]
        .sort((a, b) => a.name.localeCompare(b.name, locale))
        .filter((p) => !q || p.name.toLowerCase().includes(q));
    return (
        <div className="space-y-2">
            {data.people.length > 8 && (
                <SearchBox
                    value={search}
                    onChange={setSearch}
                    placeholder={t("chat.searchPeople")}
                    clearLabel={t("common.close")}
                />
            )}
            <SectionLabel>{`${t("chat.members")} (${ids.length})`}</SectionLabel>
            <div>
                {people.map((p) => {
                    const on = ids.includes(p.id);
                    return (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() =>
                                onChange(on ? ids.filter((x) => x !== p.id) : [...ids, p.id])
                            }
                            className="flex w-full items-center gap-3 border-b border-slate-100 py-2.5 text-left last:border-b-0 active:opacity-70"
                        >
                            <Avatar url={p.avatar} size={32} />
                            <span className="min-w-0 flex-1 truncate text-[16px] text-gray-900">
                                {p.name}
                            </span>
                            <span
                                className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${
                                    on
                                        ? "border-brand bg-brand text-white"
                                        : "border-gray-300 bg-white"
                                }`}
                            >
                                {on && <Check size={16} strokeWidth={4} />}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/** A new group: its name, its people (me ticked to start), then into it. */
export function NewGroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    const t = useT();
    const slug = useSlug();
    const navigate = useNavigate();
    const me = useMe().data?.user?.id ?? "";
    const create = useCreateGroup();
    const [name, setName] = useState("");
    const [picked, setPicked] = useState<string[]>(me ? [me] : []);
    return (
        <Sheet open={open} onClose={onClose} title={t("chat.newGroup")}>
            <div className="chat space-y-4 pb-2">
                <TextInput value={name} onChange={setName} placeholder={t("chat.groupName")} />
                <PeoplePicker picked={picked} onChange={setPicked} />
                <ActionButton
                    disabled={!name.trim()}
                    action={async () => {
                        const out = await create.mutateAsync({
                            name: name.trim(),
                            members: picked,
                        });
                        onClose();
                        if (out) void navigate({ to: `/${slug}/chats/${out.id}` });
                    }}
                    className="w-full rounded-xl bg-brand py-3 text-[16px] font-semibold text-white disabled:opacity-40"
                >
                    {t("chat.createGroup")}
                </ActionButton>
            </div>
        </Sheet>
    );
}
