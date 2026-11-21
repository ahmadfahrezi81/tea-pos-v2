import type { components } from "@tea-pos/api-client";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { Avatar } from "@tea-pos/ui/Avatar";
import { Badge } from "@tea-pos/ui/Badge";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";
import { Sheet } from "@tea-pos/ui/Sheet";
import { ActionButton } from "@tea-pos/ui/ActionButton";
import { TextInput } from "@tea-pos/ui/form/TextInput";
import { Archive, ArchiveRestore, BellOff, BellRing, Pencil, UserPlus } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
    PeoplePicker,
    useChatAdmin,
    useFollow,
    useSetGroupMembers,
    useUpdateGroup,
} from "./groups";
import { channelName, KIND_ICON } from "./labels";

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

/** The channel in the header, as WhatsApp: its icon, its name, how many are in it; a tap opens its info. */
export function ChannelHeader({ channel, me }: { channel: Channel; me: string }) {
    const t = useT();
    const locale = useLocale();
    const [open, setOpen] = useState(false);
    const Icon = KIND_ICON[channel.kind];
    const members = sorted(channel.members, me, locale);
    const who =
        channel.kind === "personal"
            ? t("chat.whoPersonal")
            : members.length === 1
              ? t("chat.oneMember")
              : t("chat.memberCount").replace("{n}", String(members.length));
    return (
        <>
            <HeaderTitle onClick={() => setOpen(true)}>
                <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-200">
                        <Icon size={18} className="text-gray-900" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-lg font-bold leading-tight">
                            {channelName(channel, t)}
                        </span>
                        <span className="block truncate text-xs font-normal tracking-normal text-gray-500">
                            {who}
                        </span>
                    </span>
                </span>
            </HeaderTitle>
            {open && (
                <ChannelInfo
                    channel={channel}
                    members={members}
                    me={me}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}

/**
 * A channel's details (RFC screen 5, without settings: chat is the company's, nobody leaves). A
 * chat admin also renames, archives and picks a group's people, and follows what is not theirs.
 */
function ChannelInfo({
    channel,
    members,
    me,
    onClose,
}: {
    channel: Channel;
    members: Member[];
    me: string;
    onClose: () => void;
}) {
    const t = useT();
    const admin = useChatAdmin();
    const [view, setView] = useState<"info" | "rename" | "members">("info");
    const update = useUpdateGroup(channel.id);
    const setMembers = useSetGroupMembers(channel.id);
    const follow = useFollow(channel.id);
    const [name, setName] = useState(channel.name ?? "");
    const [picked, setPicked] = useState<string[] | null>(null);
    const Icon = KIND_ICON[channel.kind];
    const group = admin && channel.kind === "group";
    const back = () => setView("info");
    if (view === "rename")
        return (
            <Sheet open onClose={onClose} onBack={back} title={t("chat.rename")}>
                <div className="chat space-y-4 pb-2">
                    <TextInput value={name} onChange={setName} placeholder={t("chat.groupName")} />
                    <SaveButton
                        disabled={!name.trim() || name.trim() === channel.name}
                        action={async () => {
                            await update.mutateAsync({ name: name.trim() });
                            back();
                        }}
                    >
                        {t("chat.save")}
                    </SaveButton>
                </div>
            </Sheet>
        );
    if (view === "members")
        return (
            <Sheet open onClose={onClose} onBack={back} title={t("chat.editMembers")}>
                <div className="chat space-y-4 pb-2">
                    <PeoplePicker group={channel.id} picked={picked} onChange={setPicked} />
                    <SaveButton
                        disabled={picked === null}
                        action={async () => {
                            await setMembers.mutateAsync({ members: picked ?? [] });
                            back();
                        }}
                    >
                        {t("chat.save")}
                    </SaveButton>
                </div>
            </Sheet>
        );
    return (
        <Sheet open onClose={onClose} title={t("chat.info")}>
            <div className="chat space-y-5 pb-4">
                <div className="flex flex-col items-center gap-1.5 text-center">
                    <span className="flex size-16 items-center justify-center rounded-2xl bg-slate-100">
                        <Icon size={28} className="text-gray-900" />
                    </span>
                    <p className="pt-1 text-xl font-bold text-gray-900">
                        {channelName(channel, t)}
                    </p>
                    <p className="text-sm text-gray-500">
                        {channel.archived ? t("chat.archivedGroup") : t(WHO[channel.kind])}
                    </p>
                </div>
                {(group ||
                    (admin &&
                        channel.kind !== "personal" &&
                        (!channel.mine || channel.following))) && (
                    <div className="overflow-hidden rounded-2xl bg-slate-100">
                        {group && (
                            <>
                                <InfoAction
                                    icon={<Pencil size={20} />}
                                    onClick={() => setView("rename")}
                                >
                                    {t("chat.rename")}
                                </InfoAction>
                                <InfoAction
                                    icon={<UserPlus size={20} />}
                                    onClick={() => setView("members")}
                                >
                                    {t("chat.editMembers")}
                                </InfoAction>
                                <InfoAction
                                    icon={
                                        channel.archived ? (
                                            <ArchiveRestore size={20} />
                                        ) : (
                                            <Archive size={20} />
                                        )
                                    }
                                    onClick={() => update.mutate({ archived: !channel.archived })}
                                >
                                    {t(channel.archived ? "chat.unarchive" : "chat.archive")}
                                </InfoAction>
                            </>
                        )}
                        {admin &&
                            channel.kind !== "personal" &&
                            (!channel.mine || channel.following) && (
                                <InfoAction
                                    icon={
                                        channel.following ? (
                                            <BellOff size={20} />
                                        ) : (
                                            <BellRing size={20} />
                                        )
                                    }
                                    onClick={() => follow.mutate({ on: !channel.following })}
                                >
                                    {t(channel.following ? "chat.unfollow" : "chat.follow")}
                                </InfoAction>
                            )}
                    </div>
                )}
                {channel.kind !== "personal" && (
                    <section className="space-y-1">
                        <SectionLabel>{`${t("chat.members")} (${members.length})`}</SectionLabel>
                        {members.map((m) => (
                            <div
                                key={m.id}
                                className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-b-0"
                            >
                                <Avatar url={m.avatar} size={32} />
                                <span className="flex min-w-0 flex-1 items-center gap-2">
                                    <span className="truncate text-[16px] text-gray-900">
                                        {m.id === me ? `${m.name} (${t("chat.you")})` : m.name}
                                    </span>
                                    {m.vip && (
                                        <Badge tone="brand" size="sm">
                                            {t("chat.vip")}
                                        </Badge>
                                    )}
                                </span>
                            </div>
                        ))}
                    </section>
                )}
            </div>
        </Sheet>
    );
}

/** One of a chat admin's actions in a channel's info. */
function InfoAction({
    icon,
    onClick,
    children,
}: {
    icon: ReactNode;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-center gap-3 border-b border-white px-4 py-3 text-left text-[16px] font-medium text-gray-900 last:border-b-0 active:opacity-70"
        >
            <span className="text-gray-700">{icon}</span>
            {children}
        </button>
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
