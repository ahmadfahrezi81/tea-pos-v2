import { $api, api, type components } from "@tea-pos/api-client";
import { STALE } from "@tea-pos/api-client/query";
import { formatCount } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { ConfirmSheet } from "@tea-pos/shell/FormFooter";
import { HeaderActions, HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { useAccess, useSlug } from "@tea-pos/shell/tenant";
import { useApiMutation } from "@tea-pos/shell/useApiMutation";
import { ActionButton } from "@tea-pos/ui/ActionButton";
import { Avatar } from "@tea-pos/ui/Avatar";
import { Badge } from "@tea-pos/ui/Badge";
import { TextInput } from "@tea-pos/ui/form/TextInput";
import { ImagePreview } from "@tea-pos/ui/ImagePreview";
import { SearchBox } from "@tea-pos/ui/SearchBox";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";
import { Sheet } from "@tea-pos/ui/Sheet";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
    Archive,
    ArchiveRestore,
    BellOff,
    Eraser,
    Pencil,
    UserPlus,
    type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import {
    PeoplePicker,
    useChatAdmin,
    useFollow,
    useSetGroupMembers,
    useUpdateGroup,
} from "./groups";
import { channelName, KIND_ICON } from "./labels";
import { LinkCard } from "./links";
import { useChannel } from "./queries";

type Channel = components["schemas"]["ChatChannelOutputBody"];
type Member = Channel["members"][number];

const WHO: Record<Channel["kind"], MessageKey> = {
    general: "chat.whoGeneral",
    store: "chat.whoStore",
    group: "chat.whoGroup",
    admin: "chat.whoAdmin",
    personal: "chat.whoPersonal",
};

/** Me first, then by name; a chat admin only following it is not one of its people. */
function sorted(members: Member[], me: string, locale: string): Member[] {
    return members
        .filter((m) => !m.follower)
        .sort((a, b) => +(b.id === me) - +(a.id === me) || a.name.localeCompare(b.name, locale));
}

/**
 * The channel in the header, as WhatsApp: its icon, its name, how many are in it. Its name and
 * the ⋯ at the top right open its info page (task 078).
 */
export function ChannelHeader({ channel, me }: { channel: Channel; me: string }) {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const navigate = useNavigate();
    const Icon = KIND_ICON[channel.kind];
    const members = sorted(channel.members, me, locale);
    const who =
        channel.kind === "personal"
            ? t("chat.whoPersonal")
            : members.length === 1
              ? t("chat.oneMember")
              : t("chat.memberCount").replace("{n}", String(members.length));
    const info = `/${slug}/chats/${channel.id}/info`;
    return (
        <>
            <HeaderTitle onClick={() => void navigate({ to: info })}>
                <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-200">
                        <Icon size={18} className="text-gray-900" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-lg font-bold leading-tight">
                            {channelName(channel, t)}
                        </span>
                        <span className="block truncate text-xs font-normal tracking-normal text-gray-600">
                            {who}
                        </span>
                    </span>
                </span>
            </HeaderTitle>
            <HeaderActions actions={[{ kind: "more", to: info }]} />
        </>
    );
}

/** A chat's photos and shared screens, read when its info opens. */
function useMedia(id: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/chat/channels/{id}/media",
        { params: { path: { tenant, id } } },
        { enabled: !!tenant, staleTime: STALE.QUICK, meta: { live: ["chat"] } },
    );
}

const FEW_MEMBERS = 5;
const FEW_PHOTOS = 8;
const FEW_SHARED = 3;

/**
 * A chat's info, a page of its own (task 078): who it is for and how much was said, its photos,
 * what was shared, its people; the ⋯ menu changes it, each action only for who may.
 */
export default function ChannelInfoScreen({ channelId }: { channelId: string }) {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const { data: channel } = useChannel(slug, channelId);
    const { data: media } = useMedia(channelId);
    const [allMembers, setAllMembers] = useState(false);
    const [allPhotos, setAllPhotos] = useState(false);
    const [allShared, setAllShared] = useState(false);
    const [q, setQ] = useState("");
    const [photo, setPhoto] = useState<string | null>(null);
    if (!channel)
        return (
            <div className="space-y-3">
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-48 rounded-2xl" />
            </div>
        );
    const Icon = KIND_ICON[channel.kind];
    const members = sorted(channel.members, "", locale);
    const needle = q.trim().toLocaleLowerCase(locale);
    const shownMembers = allMembers
        ? members.filter((m) => !needle || m.name.toLocaleLowerCase(locale).includes(needle))
        : members.slice(0, FEW_MEMBERS);
    const photos = media?.photos ?? [];
    const shared = media?.shared ?? [];
    return (
        <div className="chat space-y-5 pb-6">
            <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                    <Icon size={24} className="text-gray-900" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-bold text-gray-900">
                        {channelName(channel, t)}
                    </span>
                    <span className="block text-sm text-gray-600">
                        {channel.archived ? t("chat.archivedGroup") : t(WHO[channel.kind])}
                    </span>
                    <span className="block text-sm text-gray-600">
                        {t(
                            channel.messages === 1 ? "chat.oneMessage" : "chat.messageCount",
                        ).replace("{n}", formatCount(channel.messages ?? 0))}
                    </span>
                </span>
            </div>

            {photos.length > 0 && (
                <Section
                    title={t("chat.photos")}
                    more={photos.length > FEW_PHOTOS && !allPhotos}
                    onMore={() => setAllPhotos(true)}
                >
                    <div className="grid grid-cols-4 gap-1.5">
                        {(allPhotos ? photos : photos.slice(0, FEW_PHOTOS)).map((p, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setPhoto(p.url)}
                                className="aspect-square overflow-hidden rounded-lg bg-slate-200"
                            >
                                {p.previewUrl && (
                                    <img
                                        src={p.previewUrl}
                                        alt=""
                                        className="size-full object-cover"
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </Section>
            )}

            {shared.length > 0 && (
                <Section
                    title={t("chat.shared")}
                    more={shared.length > FEW_SHARED && !allShared}
                    onMore={() => setAllShared(true)}
                >
                    <div className="space-y-1">
                        {(allShared ? shared : shared.slice(0, FEW_SHARED)).map(
                            (m) => m.link && <LinkCard key={m.id} link={m.link} />,
                        )}
                    </div>
                </Section>
            )}

            {channel.kind !== "personal" && (
                <Section
                    title={`${t("chat.members")} · ${members.length}`}
                    more={members.length > FEW_MEMBERS && !allMembers}
                    onMore={() => setAllMembers(true)}
                >
                    {allMembers && (
                        <div className="mb-2">
                            <SearchBox
                                value={q}
                                onChange={setQ}
                                placeholder={t("chat.searchPeople")}
                                clearLabel={t("common.close")}
                            />
                        </div>
                    )}
                    <div className="rounded-2xl bg-white px-4">
                        {shownMembers.map((m) => (
                            <div
                                key={m.id}
                                className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-b-0"
                            >
                                <Avatar url={m.avatar} size={32} />
                                <span className="min-w-0 flex-1 truncate text-[16px] text-gray-900">
                                    {m.name}
                                </span>
                                {m.vip && (
                                    <Badge tone="brand" size="sm">
                                        {t("chat.vip")}
                                    </Badge>
                                )}
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {photo && <ImagePreview open onClose={() => setPhoto(null)} src={photo} title="" />}
            {/* What changes the chat, at the bottom, each only for who may (owner: no ⋯ here). */}
            <InfoActions channel={channel} />
        </div>
    );
}

function Section({
    title,
    more,
    onMore,
    children,
}: {
    title: string;
    more: boolean;
    onMore: () => void;
    children: ReactNode;
}) {
    const t = useT();
    return (
        <section className="space-y-1.5">
            <div className="flex items-center justify-between pr-1">
                <SectionLabel>{title}</SectionLabel>
                {more && (
                    <button
                        type="button"
                        onClick={onMore}
                        className="text-sm font-semibold text-brand"
                    >
                        {t("chat.seeAll")}
                    </button>
                )}
            </div>
            {children}
        </section>
    );
}

/** Empties the chat for everyone (the owner only); nothing is deleted, only hidden. */
function useClearChat(id: string) {
    const tenant = useSlug();
    const queryClient = useQueryClient();
    return useApiMutation(
        async (_: object, headers) => {
            const { error } = await api.POST("/tenants/{tenant}/chat/channels/{id}/clear", {
                params: { path: { tenant, id } },
                headers,
            });
            if (error) throw error;
        },
        {
            onSuccess: () =>
                void queryClient.invalidateQueries({
                    predicate: (q) =>
                        String(q.queryKey[1] ?? "").includes("/chat/") ||
                        q.queryKey[0] === "chat-messages",
                }),
        },
    );
}

/**
 * What changes the chat, at the bottom of its info, each only for who may. Rename, members and archive: a chat
 * admin, on a group. Unfollow: a chat admin following a chat they are not in. Clear: the owner.
 */
function InfoActions({ channel }: { channel: Channel }) {
    const t = useT();
    const admin = useChatAdmin();
    const { owner } = useAccess();
    const [view, setView] = useState<"menu" | "rename" | "members" | "clear">("menu");
    const update = useUpdateGroup(channel.id);
    const setMembers = useSetGroupMembers(channel.id);
    const follow = useFollow(channel.id);
    const clear = useClearChat(channel.id);
    const [name, setName] = useState(channel.name ?? "");
    const [picked, setPicked] = useState<string[] | null>(null);
    const group = admin && channel.kind === "group";
    const close = () => setView("menu");
    const back = close;
    const rows: { icon: LucideIcon; label: MessageKey; onClick: () => void; danger?: boolean }[] = [
        ...(group
            ? [
                  {
                      icon: Pencil,
                      label: "chat.rename" as MessageKey,
                      onClick: () => setView("rename"),
                  },
                  {
                      icon: UserPlus,
                      label: "chat.editMembers" as MessageKey,
                      onClick: () => setView("members"),
                  },
                  {
                      icon: channel.archived ? ArchiveRestore : Archive,
                      label: (channel.archived ? "chat.unarchive" : "chat.archive") as MessageKey,
                      onClick: () => {
                          update.mutate({ archived: !channel.archived });
                          close();
                      },
                  },
              ]
            : []),
        ...(admin && channel.following
            ? [
                  {
                      icon: BellOff,
                      label: "chat.unfollow" as MessageKey,
                      onClick: () => {
                          follow.mutate({ on: false });
                          close();
                      },
                  },
              ]
            : []),
        ...(owner && channel.kind !== "personal"
            ? [
                  {
                      icon: Eraser,
                      label: "chat.clear" as MessageKey,
                      onClick: () => setView("clear"),
                      danger: true,
                  },
              ]
            : []),
    ];
    if (view === "clear")
        return (
            <ConfirmSheet
                title={t("chat.clearConfirm")}
                message={t("chat.clearSub")}
                label={t("chat.clear")}
                tone="gray"
                emoji="sparkles"
                onConfirm={async () => {
                    await clear.mutateAsync({});
                    close();
                }}
                onError={back}
                onCancel={back}
            />
        );
    if (view === "rename")
        return (
            <Sheet open onClose={close} onBack={back} title={t("chat.rename")}>
                <div className="chat space-y-4 pb-2">
                    <TextInput value={name} onChange={setName} placeholder={t("chat.groupName")} />
                    <SaveButton
                        disabled={!name.trim() || name.trim() === channel.name}
                        action={async () => {
                            await update.mutateAsync({ name: name.trim() });
                            close();
                        }}
                    >
                        {t("chat.save")}
                    </SaveButton>
                </div>
            </Sheet>
        );
    if (view === "members")
        return (
            <Sheet open onClose={close} onBack={back} title={t("chat.editMembers")}>
                <div className="chat space-y-4 pb-2">
                    <PeoplePicker group={channel.id} picked={picked} onChange={setPicked} />
                    <SaveButton
                        disabled={picked === null}
                        action={async () => {
                            await setMembers.mutateAsync({ members: picked ?? [] });
                            close();
                        }}
                    >
                        {t("chat.save")}
                    </SaveButton>
                </div>
            </Sheet>
        );
    if (rows.length === 0) return null;
    return (
        <div className="overflow-hidden rounded-2xl bg-white">
            {rows.map(({ icon: Icon, label, onClick, danger }) => (
                <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3.5 text-left text-[16px] font-medium last:border-b-0 active:bg-slate-50 ${danger ? "text-red-600" : "text-gray-900"}`}
                >
                    <Icon size={20} className={danger ? "text-red-600" : "text-gray-700"} />
                    {t(label)}
                </button>
            ))}
        </div>
    );
}

function SaveButton({
    disabled,
    action,
    children,
}: {
    disabled: boolean;
    action: () => Promise<unknown>;
    children: ReactNode;
}) {
    return (
        <ActionButton
            disabled={disabled}
            action={action}
            resetOnSuccess
            className="w-full rounded-xl bg-brand py-3 text-[16px] font-semibold text-white disabled:opacity-40"
        >
            {children}
        </ActionButton>
    );
}
