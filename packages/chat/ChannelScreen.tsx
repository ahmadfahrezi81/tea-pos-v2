import { api } from "@tea-pos/api-client";
import { useMe } from "@tea-pos/api-client/me";
import { addDays, formatDate, formatTime, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { FooterSlot } from "@tea-pos/shell/FooterSlotContext";
import { useSearchParam } from "@tea-pos/shell/searchParam";
import { useApiMutation } from "@tea-pos/shell/useApiMutation";
import { useSlug } from "@tea-pos/shell/tenant";
import { Avatar } from "@tea-pos/ui/Avatar";
import { Badge } from "@tea-pos/ui/Badge";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { ImagePreview } from "@tea-pos/ui/ImagePreview";
import { Sheet } from "@tea-pos/ui/Sheet";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { useQueryClient } from "@tanstack/react-query";
import {
    ArrowDown,
    AtSign,
    Bell,
    Camera,
    CircleAlert,
    CheckCheck,
    Clock,
    Image as ImageIcon,
    MessagesSquare,
    PenLine,
    Plus,
    SendHorizontal,
    X,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { ChannelHeader } from "./ChannelInfo";
import { eventText } from "./events";
import { channelName } from "./labels";
import { LinkCard } from "./links";
import { doneTyping, sayTyping, stoppedTyping, useTyping } from "./typing";
import { forget, retry, send, snapshot, subscribe, type Pending } from "./outbox";
import { FailedMenu, MessageMenu, useHold } from "./menu";
import { withMentions } from "./mentions";
import { Reactions, toggleReaction } from "./reactions";
import { threadKey, useChannel, useThread, type ChatMessage, type Thread } from "./queries";
import { goToMessage, useChannelScroll, useEarlier } from "./scroll";

type Member = { id: string; name: string; avatar?: string; readAt?: string };

/** How often, at most, the phone says how far it has read. */
const READ_EVERY_MS = 5000;
/** A message can be edited this long after it is sent (Go's editWindow). */
const EDIT_MS = 15 * 60 * 1000;
const MAX_LENGTH = 4000;

/** One channel: messages newest at the bottom, the box to write in (RFC: Chat (v2), screen 2). */
export default function ChannelScreen({ channelId }: { channelId: string }) {
    return (
        <div className="chat">
            <Channel channelId={channelId} />
        </div>
    );
}

function Channel({ channelId }: { channelId: string }) {
    const t = useT();
    const slug = useSlug();
    const meUser = useMe().data?.user;
    const me = meUser?.id ?? "";
    const myName = meUser?.fullName ?? "";
    const channel = useChannel(slug, channelId).data;
    const thread = useThread(slug, channelId);
    const outbox = useSyncExternalStore(subscribe, snapshot).filter((p) => p.channel === channelId);
    const items = thread.data?.items ?? [];

    // Where I had read to when I opened it: the New messages line stays put while I am here.
    const [readAtOpen, setReadAtOpen] = useState<string | null>(null);
    const myRead = channel?.members.find((m) => m.id === me)?.readAt ?? "";
    if (channel && readAtOpen === null) setReadAtOpen(myRead);

    // A message the server has sent back is no longer pending.
    const sent = new Set(items.map((m) => m.clientKey).filter(Boolean));
    useEffect(() => {
        for (const p of outbox) if (sent.has(p.key)) forget(p.key);
    });
    const waiting = outbox.filter((p) => !sent.has(p.key));

    useMarkRead(slug, channelId, items.at(-1)?.at);
    // Their message came: they have stopped typing.
    const newest = items.at(-1);
    useEffect(() => {
        if (newest?.authorId) stoppedTyping(channelId, newest.authorId);
    }, [channelId, newest?.id, newest?.authorId]);
    const queryClient = useQueryClient();
    const [seenOf, setSeenOf] = useState<ChatMessage | null>(null);
    const [menuOf, setMenuOf] = useState<ChatMessage | null>(null);
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
    const [editing, setEditing] = useState<ChatMessage | null>(null);
    // Whether the held message could still be edited when its menu opened (15 minutes).
    const [editable, setEditable] = useState(false);
    const [sentHere, setSentHere] = useState(0);
    // Opened from Activity: at that message, once.
    const [jump] = useSearchParam("m");
    const [jumpTo] = useState(jump);

    const ready = !!channel && !!thread.data;
    const firstNew = items.find(
        // Never opened before: no line, everything is new.
        (m) => m.authorId !== me && !!readAtOpen && m.at > readAtOpen,
    )?.id;
    const { end, away, fresh, toBottom } = useChannelScroll({
        ids: ready ? [...items.map((m) => m.id), ...waiting.map((p) => p.key)] : [],
        firstNew,
        jumpTo: jumpTo || undefined,
        sent: sentHere,
    });
    // A message older than the first page: history loads until it is there.
    useEffect(() => {
        if (ready && jumpTo && !document.querySelector(`[data-message-id="${CSS.escape(jumpTo)}"]`))
            void goToMessage(queryClient, slug, channelId, jumpTo);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when it opens
    }, [ready]);
    const { top: earlierTop, busy: earlierBusy } = useEarlier(
        queryClient,
        slug,
        channelId,
        items[0]?.id,
        !!thread.data?.next,
    );

    if (!channel || !thread.data)
        return (
            <div className="space-y-3">
                <Skeleton className="h-14 rounded-2xl w-2/3" />
                <Skeleton className="h-14 rounded-2xl w-1/2 ml-auto" />
                <Skeleton className="h-14 rounded-2xl w-3/4" />
            </div>
        );

    const others = channel.members.filter((m) => m.id !== me);
    const vips = new Set(channel.members.filter((m) => m.vip).map((m) => m.id));
    const lastMine = [...items].reverse().find((m) => m.authorId === me);
    const iAmAdmin = !!channel.members.find((m) => m.id === me)?.admin;

    return (
        // As WhatsApp: a tap on the messages puts the keyboard away.
        <div
            className="space-y-1 pb-2"
            onClick={(e) => {
                // React passes clicks up from portals (the box, sheets): only the messages' own count.
                if (!e.currentTarget.contains(e.target as Node)) return;
                const a = document.activeElement;
                if (a instanceof HTMLTextAreaElement) a.blur();
            }}
        >
            <ChannelHeader channel={channel} me={me} />
            <FloatingDay />
            {thread.data.next && (
                <div
                    ref={earlierTop}
                    className="flex h-10 items-center justify-center text-xs font-medium text-gray-500"
                >
                    {earlierBusy && t("chat.earlier")}
                </div>
            )}
            {items.length === 0 && waiting.length === 0 && (
                <EmptyState
                    title={t("chat.noMessages")}
                    body={t(channel.readOnly ? "chat.noMessagesInbox" : "chat.noMessagesSub")}
                    icon={channel.kind === "personal" ? Bell : MessagesSquare}
                    className="py-16"
                />
            )}
            {items.map((m, i) => (
                <Fragment key={m.id}>
                    {(i === 0 || localDate(items[i - 1]!.at) !== localDate(m.at)) && (
                        <DayLine at={m.at} />
                    )}
                    {m.id === firstNew && <NewLine />}
                    <Message
                        m={m}
                        mine={m.authorId === me}
                        grouped={
                            i > 0 &&
                            items[i - 1]!.authorId === m.authorId &&
                            localDate(items[i - 1]!.at) === localDate(m.at)
                        }
                        seen={m.id === lastMine?.id ? seenCount(others, m) : undefined}
                        onSeen={() => setSeenOf(m)}
                        names={channel.members.map((x) => x.name)}
                        onHold={() => {
                            setMenuOf(m);
                            setEditable(Date.now() - Date.parse(m.at) < EDIT_MS);
                        }}
                        onReact={
                            channel.readOnly
                                ? undefined
                                : (e) =>
                                      void toggleReaction(
                                          queryClient,
                                          slug,
                                          channelId,
                                          m,
                                          e,
                                          myName,
                                          t("chat.notSentShort"),
                                      )
                        }
                        active={menuOf?.id === m.id}
                        onQuote={(id) => void goToMessage(queryClient, slug, channelId, id)}
                        vip={!!m.authorId && vips.has(m.authorId)}
                    />
                </Fragment>
            ))}
            {waiting.map((p, i) => {
                const prev = i > 0 ? null : items.at(-1);
                // Grouped as the sent one will be: after my own message the same day.
                const grouped =
                    i > 0 ||
                    (!!prev && prev.authorId === me && localDate(prev.at) === localDate(p.at));
                return (
                    <Outgoing
                        key={p.key}
                        p={p}
                        slug={slug}
                        grouped={grouped}
                        names={channel.members.map((x) => x.name)}
                        me={{ name: myName, avatar: meUser?.avatarUrl }}
                        vip={vips.has(me)}
                    />
                );
            })}
            <div ref={end} />
            <Composer
                channelId={channelId}
                name={channelName(channel, t)}
                readOnly={channel.readOnly}
                kind={channel.kind}
                members={channel.members}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                editing={editing}
                onCancelEdit={() => setEditing(null)}
                canEveryone={!!channel.members.find((x) => x.id === me)?.vip}
                me={me}
                onSent={() => {
                    setReplyTo(null);
                    setEditing(null);
                    setSentHere((n) => n + 1);
                }}
                down={away ? { fresh, go: toBottom } : undefined}
            />
            {menuOf && (
                <MessageMenu
                    m={menuOf}
                    channelId={channelId}
                    names={channel.members.map((x) => x.name)}
                    canReply={!channel.readOnly}
                    canDelete={!menuOf.event && (menuOf.authorId === me || iAmAdmin)}
                    canEdit={
                        !channel.readOnly && menuOf.authorId === me && !!menuOf.body && editable
                    }
                    onEdit={() => {
                        setReplyTo(null);
                        setEditing(menuOf);
                        // In the tap itself, so the phone opens its keyboard.
                        document.querySelector<HTMLTextAreaElement>("[data-chat-box]")?.focus();
                    }}
                    onReact={
                        channel.readOnly
                            ? undefined
                            : (e) =>
                                  void toggleReaction(
                                      queryClient,
                                      slug,
                                      channelId,
                                      menuOf,
                                      e,
                                      myName,
                                      t("chat.notSentShort"),
                                  )
                    }
                    mine={menuOf.authorId === me && !menuOf.event}
                    onReply={() => {
                        setEditing(null);
                        setReplyTo(menuOf);
                        // In the tap itself, so the phone opens its keyboard.
                        document.querySelector<HTMLTextAreaElement>("[data-chat-box]")?.focus();
                    }}
                    onSeen={() => setSeenOf(menuOf)}
                    onClose={() => setMenuOf(null)}
                />
            )}
            {seenOf && (
                <SeenBy
                    message={seenOf}
                    members={others.filter((m) => m.id !== seenOf.authorId)}
                    onClose={() => setSeenOf(null)}
                />
            )}
        </div>
    );
}

function seenCount(others: Member[], m: ChatMessage): number {
    return others.filter((o) => (o.readAt ?? "") >= m.at).length;
}

function dayLabel(at: string, t: ReturnType<typeof useT>, locale: ReturnType<typeof useLocale>) {
    const day = localDate(at);
    const today = localDate();
    if (day === today) return t("chat.today");
    if (day === addDays(today, -1)) return t("chat.yesterday");
    return formatDate(at, locale);
}

function DayLine({ at }: { at: string }) {
    const t = useT();
    const locale = useLocale();
    return (
        <div data-day className="flex justify-center py-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600">
                {dayLabel(at, t, locale)}
            </span>
        </div>
    );
}

/**
 * As WhatsApp: while scrolling, the day of the messages at the top floats over them, and fades
 * a moment after the scrolling stops; hidden where that day's own line is already in sight.
 */
function FloatingDay() {
    const t = useT();
    const locale = useLocale();
    const [at, setAt] = useState("");
    const [shown, setShown] = useState(false);
    useEffect(() => {
        const s = document.getElementById("shell-scroll");
        if (!s) return;
        let timer = 0;
        const onScroll = () => {
            const top = s.getBoundingClientRect().top;
            const lineAtTop = [...s.querySelectorAll("[data-day]")].some((d) => {
                const r = d.getBoundingClientRect();
                return r.bottom > top && r.top < top + 48;
            });
            const first = [...s.querySelectorAll<HTMLElement>("[data-at]")].find(
                (r) => r.getBoundingClientRect().bottom > top + 8,
            );
            setAt(first?.dataset.at ?? "");
            setShown(!!first && !lineAtTop);
            clearTimeout(timer);
            timer = window.setTimeout(() => setShown(false), 1000);
        };
        s.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            s.removeEventListener("scroll", onScroll);
            clearTimeout(timer);
        };
    }, []);
    return (
        <div className="pointer-events-none sticky top-0 z-10 h-0">
            <div
                className={`flex justify-center pt-1 transition-opacity duration-300 ${shown && at ? "opacity-100" : "opacity-0"}`}
            >
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm">
                    {at && dayLabel(at, t, locale)}
                </span>
            </div>
        </div>
    );
}

function NewLine() {
    const t = useT();
    return (
        <div className="flex items-center gap-2 py-2 text-xs font-semibold text-brand">
            <span className="h-px flex-1 bg-brand/40" />
            {t("chat.newMessages")}
            <span className="h-px flex-1 bg-brand/40" />
        </div>
    );
}

/**
 * One geometry for every bubble: 10 px round with 12 px of side padding; what sits inside it (a
 * quote, photos) is 4 px in on every side and 6 px round, so the two curves run parallel.
 * Everyone's on the left, white, as wide as their content up to the full row (owner: long
 * automated content to come); the corner by the sender's photo is the tail.
 */
const BUBBLE = "rounded-[10px] rounded-tl-[4px] bg-white px-3 py-1.5 text-gray-900";
/** 4 px in from the bubble's sides (12 − 8), and from its top when first (6 − 2). */
const INSET_X = "-mx-2";
const INSET_TOP = "-mt-0.5";
const INNER = "rounded-[6px]";
/** Under the tail's 4 px corner, an inner corner of 2 px. */
const TAIL_INNER = "rounded-tl-[2px]";

function Message({
    m,
    mine,
    grouped,
    seen,
    onSeen,
    onHold,
    onReact,
    onQuote,
    names,
    active,
    vip,
}: {
    m: ChatMessage;
    mine: boolean;
    grouped: boolean;
    seen?: number;
    onSeen: () => void;
    /** Held down: the message's menu. */
    onHold: () => void;
    /** A reaction tapped under it; absent where nobody posts. */
    onReact?: (emoji: string) => void;
    /** The channel's people, for their @mentions; mine is lit. */
    names: string[];
    /** Its quote tapped: to the message it answers. */
    onQuote: (id: string) => void;
    /** Its menu is open: the row stays lit. */
    active: boolean;
    /** A chat admin: the VIP badge beside the name. */
    vip: boolean;
}) {
    const t = useT();
    const locale = useLocale();
    const { handlers: hold, pressing } = useHold(onHold);
    if (m.event)
        return (
            <div className="flex justify-center py-1">
                <div className="max-w-[92%] rounded-2xl bg-slate-200 px-3 py-1.5 text-center text-[13px] font-medium leading-5 text-gray-800">
                    {eventText(m, t, locale)}
                    <span className="text-gray-600"> · {formatTime(m.at, locale)}</span>
                    {m.link && <LinkCard link={m.link} />}
                </div>
            </div>
        );
    const time = formatTime(m.at, locale);
    const ticks = mine && seen !== undefined && seen > 0;
    // As WhatsApp: name, photos, text and time in one bubble; the time sits on the text's last line.
    const stamp = (
        <span className="flex items-center gap-0.5 text-[11px] leading-none text-gray-500">
            {m.editedAt && !m.deleted && <span>{t("chat.edited")}</span>}
            {time}
            {ticks && <CheckCheck size={14} strokeWidth={2.5} />}
        </span>
    );
    // Room on the last line for the time (and "edited", and the ticks) so the text never runs under it.
    // Mine always keep room for the clock or the ticks, so a sent bubble is as wide as it was sending.
    const room = 2.75 + (mine ? 1.25 : 0) + (m.editedAt && !m.deleted ? 2.75 : 0);
    const body = (m.body || m.deleted) && (
        <p className="relative text-[15px] leading-5 whitespace-pre-wrap break-words">
            {m.deleted ? (
                <span className="italic text-gray-500">{t("chat.deleted")}</span>
            ) : (
                withMentions(m.body, names)
            )}
            <span className="inline-block" style={{ width: `${room}rem` }} />
            <span className="absolute right-0 bottom-0.5">{stamp}</span>
        </p>
    );
    const q = m.replyTo;
    // As WhatsApp: a flat block with a bar on its left, never a box inside a box.
    const quote = q && (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onQuote(q.id);
            }}
            className={`${INSET_X} ${grouped ? `${INSET_TOP} ${TAIL_INNER}` : "mt-0.5"} mb-1 flex w-[calc(100%+1rem)] min-w-40 overflow-hidden ${INNER} bg-slate-100 text-left text-[13px] leading-4`}
        >
            <span className="w-1 shrink-0 bg-brand" />
            <span className="min-w-0 flex-1 px-2 py-1">
                <span className="block truncate font-semibold text-brand">
                    {q.author || t("chat.message")}
                </span>
                <span className={`line-clamp-2 text-gray-600 ${q.deleted ? "italic" : ""}`}>
                    {q.deleted ? t("chat.deleted") : q.body || t("chat.photo")}
                </span>
            </span>
        </button>
    );
    const first = grouped;
    const photos =
        !m.deleted && m.photos?.length ? (
            <div
                className={`${INSET_X} ${first && !quote ? INSET_TOP : "mt-0.5"} ${body ? "mb-1" : "-mb-0.5"}`}
            >
                <Photos
                    photos={m.photos}
                    corner={first && !quote ? TAIL_INNER : ""}
                    stamp={
                        body ? undefined : (
                            <span className="flex items-center gap-0.5">
                                {time}
                                {ticks && <CheckCheck size={14} strokeWidth={2.5} />}
                            </span>
                        )
                    }
                />
            </div>
        ) : null;
    const bubble = (
        // The phone's own text menu stays off: holding a message opens ours.
        <div
            {...(m.deleted ? {} : hold)}
            className={`max-w-full select-none ${BUBBLE} text-left transition-transform duration-200 [-webkit-touch-callout:none] ${pressing ? "scale-[0.97]" : ""}`}
        >
            {!grouped && (
                <p className="flex items-center gap-1.5 text-[14px] font-semibold leading-5 text-brand">
                    {m.author}
                    {vip && (
                        <Badge tone="brand" size="sm">
                            {t("chat.vip")}
                        </Badge>
                    )}
                </p>
            )}
            {!m.deleted && quote}
            {photos}
            {!m.deleted && m.link && <LinkCard link={m.link} />}
            {body || (!photos && <div className="flex justify-end pb-0.5">{stamp}</div>)}
            {/* Reactions belong to the bubble: inside it, under the text. */}
            {!m.deleted && !!m.reactions?.length && (
                <Reactions reactions={m.reactions} onToggle={(e) => onReact?.(e)} />
            )}
        </div>
    );
    return (
        <div
            data-message-id={m.id}
            data-at={m.at}
            className={`-mx-4 flex items-start gap-2 px-4 transition-colors duration-200 ${grouped ? "" : "pt-2"} ${pressing || active ? "bg-brand/10" : ""}`}
        >
            <span className="w-8 shrink-0">{!grouped && <Avatar url={m.avatar} size={32} />}</span>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                {bubble}
                {mine && seen !== undefined && seen > 0 && (
                    <button onClick={onSeen} className="text-[11px] text-brand">
                        {t("chat.seenBy").replace("{n}", String(seen))}
                    </button>
                )}
            </div>
        </div>
    );
}

/**
 * A message on its way, drawn exactly as the sent one will be (task 068d: the swap crumpled
 * it): the same row and bubble, the time inside with a clock, a photo in its own shape from
 * the phone's copy. It rises in as it is added; the server's copy then replaces it unseen.
 */
function Outgoing({
    p,
    slug,
    grouped,
    names,
    me,
    vip,
}: {
    p: Pending;
    slug: string;
    grouped: boolean;
    names: string[];
    /** My name and photo, as the sent one shows them. */
    me: { name: string; avatar?: string };
    vip: boolean;
}) {
    const t = useT();
    const locale = useLocale();
    const queryClient = useQueryClient();
    const [menu, setMenu] = useState(false);
    const failed = p.state === "failed";
    const q = p.replyTo;
    const stamp = (
        <span className="flex items-center gap-0.5">
            {formatTime(p.at, locale)}
            {!failed && <Clock size={12} strokeWidth={2.5} />}
        </span>
    );
    const one = p.photos.length === 1;
    return (
        <div
            data-message-id={p.key}
            className={`-mx-4 flex animate-rise-in items-start gap-2 px-4 ${grouped ? "" : "pt-2"}`}
        >
            <span className="w-8 shrink-0">{!grouped && <Avatar url={me.avatar} size={32} />}</span>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <div className="flex max-w-full items-center gap-2">
                    <div
                        onClick={() => failed && setMenu(true)}
                        className={`max-w-full min-w-0 select-none ${BUBBLE} text-left`}
                    >
                        {!grouped && (
                            <p className="flex items-center gap-1.5 text-[14px] font-semibold leading-5 text-brand">
                                {me.name}
                                {vip && (
                                    <Badge tone="brand" size="sm">
                                        {t("chat.vip")}
                                    </Badge>
                                )}
                            </p>
                        )}
                        {q && (
                            <span
                                className={`${INSET_X} ${grouped ? `${INSET_TOP} ${TAIL_INNER}` : "mt-0.5"} mb-1 flex w-[calc(100%+1rem)] min-w-40 overflow-hidden ${INNER} bg-slate-100 text-left text-[13px] leading-4`}
                            >
                                <span className="w-1 shrink-0 bg-brand" />
                                <span className="min-w-0 flex-1 px-2 py-1">
                                    <span className="block truncate font-semibold text-brand">
                                        {q.author || t("chat.message")}
                                    </span>
                                    <span className="line-clamp-2 text-gray-600">
                                        {q.body || t("chat.photo")}
                                    </span>
                                </span>
                            </span>
                        )}
                        {p.photos.length > 0 && (
                            <div
                                className={`${INSET_X} ${grouped && !q ? INSET_TOP : "mt-0.5"} ${p.body ? "mb-1" : "-mb-0.5"}`}
                            >
                                <div
                                    className={`relative grid gap-0.5 overflow-hidden ${INNER} ${grouped && !q ? TAIL_INNER : ""} ${one ? "grid-cols-1 w-56" : "grid-cols-2 w-60"}`}
                                >
                                    {p.photos.map((ph) => (
                                        <img
                                            key={ph.local}
                                            src={ph.local}
                                            alt=""
                                            className={`block w-full rounded-[2px] object-cover ${one ? "h-auto" : "aspect-square"}`}
                                        />
                                    ))}
                                    {!p.body && (
                                        <span className="pointer-events-none absolute right-0 bottom-0 flex h-8 items-end justify-end rounded-br-[6px] bg-linear-to-tl from-black/45 via-black/15 to-transparent px-2 pb-1.5 pl-8 text-[11px] leading-none text-white">
                                            {stamp}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                        {p.body && (
                            <p className="relative text-[15px] leading-5 whitespace-pre-wrap break-words">
                                {withMentions(p.body, names)}
                                <span className="inline-block" style={{ width: "4rem" }} />
                                <span className="absolute right-0 bottom-0.5 text-[11px] leading-none text-gray-500">
                                    {stamp}
                                </span>
                            </p>
                        )}
                    </div>
                    {failed && (
                        <button
                            onClick={() => setMenu(true)}
                            aria-label={t("chat.notSentShort")}
                            className="shrink-0 text-red-600 active:opacity-60"
                        >
                            <CircleAlert size={22} />
                        </button>
                    )}
                </div>
                {failed && (
                    <span className="text-[11px] font-semibold text-red-600">
                        {t("chat.notSentShort")}
                    </span>
                )}
            </div>
            {menu && (
                <FailedMenu
                    onRetry={() => retry(queryClient, slug, p.key)}
                    onDelete={() => forget(p.key)}
                    onClose={() => setMenu(false)}
                />
            )}
        </div>
    );
}

/** The white bar at the bottom: the message and send; a note instead where nobody posts. */
/** At most this many photos in one message. */
const MAX_PHOTOS = 4;

function Composer({
    channelId,
    name,
    readOnly,
    kind,
    members,
    replyTo,
    onCancelReply,
    editing,
    onCancelEdit,
    canEveryone,
    me,
    onSent,
    down,
}: {
    channelId: string;
    name: string;
    readOnly: boolean;
    kind: string;
    members: Member[];
    /** The message being answered: quoted over the box. */
    replyTo: ChatMessage | null;
    onCancelReply: () => void;
    /** My message being edited: its text in the box, "Editing" over it. */
    editing: ChatMessage | null;
    onCancelEdit: () => void;
    /** A VIP or an admin may @everyone. */
    canEveryone: boolean;
    me: string;
    onSent: () => void;
    /** Scrolled up: the arrow back to the newest, with how many came meanwhile. */
    down?: { fresh: number; go: () => void };
}) {
    const t = useT();
    const slug = useSlug();
    const queryClient = useQueryClient();
    const [text, setText] = useState("");
    const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
    const box = useRef<HTMLTextAreaElement>(null);
    const lit = useRef<HTMLDivElement>(null);
    const camera = useRef<HTMLInputElement>(null);
    const gallery = useRef<HTMLInputElement>(null);
    const [adding, setAdding] = useState(false);
    const [caret, setCaret] = useState(0);
    // A message chosen for editing puts its text in the box, once.
    const [shownEdit, setShownEdit] = useState<string | null>(null);
    if ((editing?.id ?? null) !== shownEdit) {
        setShownEdit(editing?.id ?? null);
        setText(editing?.body ?? "");
    }
    const body = text.trim();
    const ready = editing
        ? body !== "" && body.length <= MAX_LENGTH
        : (body !== "" || photos.length > 0) && body.length <= MAX_LENGTH;
    // @ and what follows it, up to the caret: the names it could be.
    const asked = /(?:^|\s)@([^@\n]{0,30})$/.exec(text.slice(0, caret))?.[1];
    const suggestions: { name: string; avatar?: string }[] =
        asked === undefined
            ? []
            : [
                  ...members.filter((x) => x.id !== me),
                  ...(canEveryone ? [{ name: "everyone", avatar: undefined }] : []),
              ]
                  .filter((x) => x.name.toLowerCase().includes(asked.toLowerCase()))
                  .slice(0, 5);
    const mention = (name: string) => {
        const start = text.slice(0, caret).lastIndexOf("@");
        const next = `${text.slice(0, start)}@${name} ${text.slice(caret)}`;
        const at = start + name.length + 2;
        setText(next);
        setCaret(at);
        requestAnimationFrame(() => box.current?.setSelectionRange(at, at));
    };
    // The @ button: an @ where the caret is (a space before it if needed), and the names show.
    const atSign = () => {
        const el = box.current;
        if (!el) return;
        el.focus();
        const at = document.activeElement === el ? caret : text.length;
        const before = text.slice(0, at);
        const add = before === "" || /\s$/.test(before) ? "@" : " @";
        const next = before + add + text.slice(at);
        const to = at + add.length;
        setText(next);
        setCaret(to);
        requestAnimationFrame(() => el.setSelectionRange(to, to));
    };
    // Shown at once; put back, with the reason, if Go refuses (useApiMutation shows it).
    const saveEdit = useApiMutation(
        async ({ m, text: next }: { m: ChatMessage; text: string }, headers) => {
            const key = threadKey(slug, channelId);
            const before = queryClient.getQueryData<Thread>(key);
            queryClient.setQueryData<Thread>(key, (now) =>
                now
                    ? {
                          ...now,
                          items: now.items.map((x) =>
                              x.id === m.id
                                  ? { ...x, body: next, editedAt: new Date().toISOString() }
                                  : x,
                          ),
                      }
                    : now,
            );
            const { error } = await api.PATCH(
                "/tenants/{tenant}/chat/channels/{id}/messages/{message}",
                {
                    params: { path: { tenant: slug, id: channelId, message: m.id } },
                    body: { body: next },
                    headers,
                },
            );
            if (error) {
                queryClient.setQueryData(key, before);
                throw error;
            }
        },
    );
    const submit = () => {
        if (!ready) return;
        if (editing) {
            if (body !== editing.body) saveEdit.mutate({ m: editing, text: body });
            onSent();
            setText("");
            if (box.current) box.current.style.height = "";
            return;
        }
        send(
            queryClient,
            slug,
            channelId,
            body,
            photos.map((p) => p.file),
            replyTo
                ? {
                      id: replyTo.id,
                      author: replyTo.author,
                      body: replyTo.body,
                      photo: !!replyTo.photos?.length,
                  }
                : undefined,
        );
        onSent();
        photos.forEach((p) => URL.revokeObjectURL(p.url));
        setPhotos([]);
        setText("");
        doneTyping(channelId);
        if (box.current) box.current.style.height = "";
    };
    const pick = (files: FileList | null) => {
        const chosen = [...(files ?? [])].slice(0, MAX_PHOTOS - photos.length);
        setPhotos((now) => [
            ...now,
            ...chosen.map((file) => ({ file, url: URL.createObjectURL(file) })),
        ]);
    };
    return (
        <FooterSlot>
            {/* The page's colour behind the corners (the typing banner's while it shows): the footer under it is white. */}
            <div className="chat relative bg-slate-200 has-[[data-typing]]:bg-[color-mix(in_oklab,var(--accent-primary)_12%,white)] [&:has([data-typing])_[data-down]]:mb-12">
                <Typing channelId={channelId} members={members} />
                {/* Names for an @, in a card above the bar (owner: not inside it). */}
                {suggestions.length > 0 && (
                    <div className="absolute inset-x-1 bottom-full z-20 mb-1 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/5">
                        {suggestions.map((x) => (
                            <button
                                key={x.name}
                                onPointerDown={(e) => e.preventDefault()}
                                onClick={() => mention(x.name)}
                                className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 active:bg-slate-100"
                            >
                                {x.name === "everyone" ? (
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                                        <AtSign size={16} />
                                    </span>
                                ) : (
                                    <Avatar url={x.avatar} size={32} />
                                )}
                                <span className="truncate text-[15px] text-gray-900">
                                    {x.name === "everyone" ? `@${t("chat.everyone")}` : x.name}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
                {down && (
                    <button
                        data-down
                        onClick={down.go}
                        aria-label={t("chat.latest")}
                        className="absolute right-3 bottom-full mb-3 flex size-11 animate-pop-in items-center justify-center rounded-full bg-white text-gray-800 shadow-md active:opacity-70"
                    >
                        <ArrowDown size={22} />
                        {down.fresh > 0 && (
                            <span className="absolute -top-1.5 -right-1 min-w-5 rounded-full bg-brand px-1.5 text-center text-[11px] font-bold leading-5 text-white">
                                {down.fresh > 99 ? "99+" : down.fresh}
                            </span>
                        )}
                    </button>
                )}
                <div className="overflow-hidden rounded-t-xl bg-white px-3 py-2">
                    {readOnly ? (
                        <p className="py-2 text-center text-sm text-gray-500">
                            {t(
                                kind === "personal"
                                    ? "chat.readOnly"
                                    : kind === "group"
                                      ? "chat.archivedGroup"
                                      : "chat.storeClosed",
                            )}
                        </p>
                    ) : (
                        <>
                            {editing && (
                                <div className="-mx-1 mb-1.5 flex items-stretch overflow-hidden rounded-lg bg-slate-100">
                                    <span className="w-1 shrink-0 bg-brand" />
                                    <span className="min-w-0 flex-1 px-2 py-1 text-[13px] leading-4">
                                        <span className="block truncate font-semibold text-brand">
                                            {t("chat.editing")}
                                        </span>
                                        <span className="line-clamp-1 text-gray-600">
                                            {editing.body}
                                        </span>
                                    </span>
                                    <button
                                        onPointerDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            onCancelEdit();
                                            setText("");
                                        }}
                                        aria-label={t("common.close")}
                                        className="px-2.5 text-gray-600 active:opacity-60"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            )}
                            {replyTo && (
                                // As WhatsApp: slim, a line on its left, no box around it.
                                <div className="-mx-1 mb-1.5 flex items-stretch overflow-hidden rounded-lg bg-slate-100">
                                    <span className="w-1 shrink-0 bg-brand" />
                                    <span className="min-w-0 flex-1 px-2 py-1 text-[13px] leading-4">
                                        <span className="block truncate font-semibold text-brand">
                                            {t("chat.replyingTo").replace(
                                                "{name}",
                                                replyTo.author || t("chat.message"),
                                            )}
                                        </span>
                                        <span className="line-clamp-1 text-gray-600">
                                            {replyTo.body || t("chat.photo")}
                                        </span>
                                    </span>
                                    <button
                                        onPointerDown={(e) => e.preventDefault()}
                                        onClick={onCancelReply}
                                        aria-label={t("common.close")}
                                        className="px-2.5 text-gray-600 active:opacity-60"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            )}
                            {photos.length > 0 && (
                                <div className="flex gap-2 pb-2">
                                    {photos.map((p) => (
                                        <span key={p.url} className="relative size-16 shrink-0">
                                            <img
                                                src={p.url}
                                                alt=""
                                                className="size-16 rounded-xl object-cover"
                                            />
                                            <button
                                                onClick={() => {
                                                    URL.revokeObjectURL(p.url);
                                                    setPhotos((now) =>
                                                        now.filter((x) => x.url !== p.url),
                                                    );
                                                }}
                                                aria-label={t("chat.delete")}
                                                className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-gray-900 text-white"
                                            >
                                                <X size={14} strokeWidth={3} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div>
                                {/* As Slack, on two lines, always (task 068d: changing shape on a tap jumped):
                                    the box, then its tools; the bar only grows with the text. */}
                                {/* The box's own text is see-through; this copy under it draws the
                                    same text with each @name lit (a textarea cannot colour part of
                                    itself). Colour and background only, so every letter keeps its place. */}
                                <div className="relative">
                                    <div
                                        ref={lit}
                                        aria-hidden
                                        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-1 py-2.5 text-[16px] leading-5 text-gray-900"
                                    >
                                        {withMentions(
                                            text,
                                            members.map((x) => x.name),
                                            true,
                                        )}
                                        {"\u200b"}
                                    </div>
                                    <textarea
                                        ref={box}
                                        data-chat-box
                                        rows={1}
                                        value={text}
                                        maxLength={MAX_LENGTH}
                                        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
                                        onScroll={(e) => {
                                            if (lit.current)
                                                lit.current.scrollTop = e.currentTarget.scrollTop;
                                        }}
                                        onChange={(e) => {
                                            setText(e.target.value);
                                            setCaret(e.target.selectionStart);
                                            if (e.target.value.trim()) sayTyping(slug, channelId);
                                            // Grows with the text, up to about five lines.
                                            e.target.style.height = "auto";
                                            e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                                        }}
                                        placeholder={t("chat.messageTo").replace("{name}", name)}
                                        className="relative block h-10 max-h-32 w-full resize-none bg-transparent px-1 py-2.5 text-[16px] leading-5 text-transparent caret-gray-900 outline-none placeholder:text-gray-500"
                                    />
                                </div>
                                <input
                                    ref={camera}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    hidden
                                    onChange={(e) => {
                                        pick(e.target.files);
                                        e.target.value = "";
                                    }}
                                />
                                <input
                                    ref={gallery}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    hidden
                                    onChange={(e) => {
                                        pick(e.target.files);
                                        e.target.value = "";
                                    }}
                                />
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onPointerDown={(e) => e.preventDefault()}
                                        onClick={() => setAdding(true)}
                                        disabled={photos.length >= MAX_PHOTOS || !!editing}
                                        aria-label={t("chat.add")}
                                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-gray-700 disabled:opacity-40 active:opacity-60"
                                    >
                                        <Plus size={20} />
                                    </button>
                                    <button
                                        onPointerDown={(e) => e.preventDefault()}
                                        onClick={atSign}
                                        aria-label={t("chat.mention")}
                                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-gray-700 active:opacity-60"
                                    >
                                        <AtSign size={19} />
                                    </button>
                                    <button
                                        onPointerDown={(e) => e.preventDefault()}
                                        onClick={submit}
                                        disabled={!ready}
                                        aria-label={t("chat.send")}
                                        className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand transition-colors active:opacity-70 disabled:bg-slate-100 disabled:text-gray-400"
                                    >
                                        <SendHorizontal
                                            size={21}
                                            strokeWidth={2.5}
                                            className="translate-x-[1.5px]"
                                        />
                                    </button>
                                </div>
                            </div>
                            <Sheet
                                open={adding}
                                onClose={() => setAdding(false)}
                                title={t("chat.add")}
                            >
                                <div className="chat space-y-2 pb-2">
                                    {(
                                        [
                                            [camera, Camera, "chat.camera"],
                                            [gallery, ImageIcon, "chat.gallery"],
                                        ] as const
                                    ).map(([input, Icon, key]) => (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                setAdding(false);
                                                input.current?.click();
                                            }}
                                            className="flex w-full items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3.5 text-left text-[16px] font-medium text-gray-900 active:opacity-70"
                                        >
                                            <Icon size={22} className="text-brand" />
                                            {t(key)}
                                        </button>
                                    ))}
                                </div>
                            </Sheet>
                        </>
                    )}
                </div>
            </div>
        </FooterSlot>
    );
}

/** A message's photos: previews only, the space kept before they load; a tap opens the full one. */
function Photos({
    photos,
    stamp,
    corner = "",
}: {
    photos: { url: string; previewUrl: string; width: number; height: number }[];
    /** The corner under the bubble's tail, when the photos come first. */
    corner?: string;
    /** Photos with no text: the time sits on the last one, as WhatsApp. */
    stamp?: ReactNode;
}) {
    const t = useT();
    const [open, setOpen] = useState<string | null>(null);
    const one = photos.length === 1;
    return (
        <>
            <div
                className={`relative grid gap-0.5 overflow-hidden ${INNER} ${corner} ${one ? "grid-cols-1 w-56" : "grid-cols-2 w-60"}`}
            >
                {photos.map((p, i) => (
                    <button
                        key={i}
                        onClick={() => p.url && setOpen(p.url)}
                        className={`overflow-hidden rounded-[2px] bg-slate-200`}
                    >
                        <img
                            src={p.previewUrl || undefined}
                            width={p.width}
                            height={p.height}
                            loading="lazy"
                            decoding="async"
                            alt=""
                            className={`block w-full object-cover ${one ? "h-auto" : "aspect-square"}`}
                            style={one ? { aspectRatio: `${p.width} / ${p.height}` } : undefined}
                        />
                    </button>
                ))}
                {stamp && (
                    <span
                        className={`pointer-events-none absolute right-0 bottom-0 flex h-8 items-end justify-end rounded-br-[6px] bg-linear-to-tl from-black/45 via-black/15 to-transparent px-2 pb-1.5 pl-8 text-[11px] leading-none text-white`}
                    >
                        {stamp}
                    </span>
                )}
            </div>
            {open && (
                <ImagePreview
                    open
                    onClose={() => setOpen(null)}
                    src={open}
                    title={t("chat.photo")}
                />
            )}
        </>
    );
}

function SeenBy({
    message,
    members,
    onClose,
}: {
    message: ChatMessage;
    members: Member[];
    onClose: () => void;
}) {
    const t = useT();
    const locale = useLocale();
    const seen = members
        .filter((m) => (m.readAt ?? "") >= message.at)
        .sort((a, b) => (a.readAt ?? "").localeCompare(b.readAt ?? ""));
    const notYet = members.filter((m) => (m.readAt ?? "") < message.at);
    const row = (m: Member, at?: string) => (
        <div
            key={m.id}
            className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-b-0"
        >
            <Avatar url={m.avatar} size={32} />
            <span className="flex-1 truncate text-[16px] text-gray-900">{m.name}</span>
            {at && <span className="text-sm text-gray-500">{formatTime(at, locale)}</span>}
        </div>
    );
    return (
        <Sheet open onClose={onClose} title={t("chat.seenByTitle")}>
            <div className="pb-4">
                {seen.map((m) => row(m, m.readAt))}
                {notYet.length > 0 && (
                    <>
                        <p className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            {t("chat.notYet")}
                        </p>
                        {notYet.map((m) => row(m))}
                    </>
                )}
            </div>
        </Sheet>
    );
}

/** "Budi is typing…" over the message box: its own component, so a typing event re-renders this line only. */
function Typing({ channelId, members }: { channelId: string; members: Member[] }) {
    const t = useT();
    const names = useTyping(channelId)
        .map((id) => members.find((m) => m.id === id)?.name.split(" ")[0])
        .filter((n): n is string => !!n);
    if (names.length === 0) return null;
    const text =
        names.length === 1
            ? t("chat.typingOne").replace("{name}", names[0]!)
            : names.length === 2
              ? t("chat.typingTwo").replace("{a}", names[0]!).replace("{b}", names[1]!)
              : t("chat.typingMany");
    return (
        // A banner over the box, as the connection's: always in sight, the messages never move for it.
        <div
            role="status"
            data-typing
            className="absolute inset-x-0 bottom-full flex animate-fade-in items-center justify-center gap-2 bg-[color-mix(in_oklab,var(--accent-primary)_12%,white)] px-4 py-1.5 text-sm font-semibold text-brand"
        >
            <PenLine size={15} strokeWidth={2.5} className="animate-write" aria-hidden />
            {text}
        </div>
    );
}

/** Says how far this phone has read: at most every few seconds, and once more on leaving. */
function useMarkRead(tenant: string, channel: string, newest?: string) {
    const sentUpTo = useRef("");
    const want = useRef("");
    useEffect(() => {
        const flush = () => {
            if (!want.current || want.current <= sentUpTo.current) return;
            sentUpTo.current = want.current;
            void api
                .POST("/tenants/{tenant}/chat/channels/{id}/read", {
                    params: { path: { tenant, id: channel } },
                    body: { at: want.current },
                })
                .catch(() => {});
        };
        const timer = setInterval(() => {
            if (document.visibilityState === "visible") flush();
        }, READ_EVERY_MS);
        return () => {
            clearInterval(timer);
            flush();
        };
    }, [tenant, channel]);
    useEffect(() => {
        if (!newest || document.visibilityState !== "visible") return;
        const first = want.current === "";
        want.current = newest;
        // Opening a channel says so at once; after that, every few seconds.
        if (first && sentUpTo.current === "") {
            sentUpTo.current = newest;
            void api
                .POST("/tenants/{tenant}/chat/channels/{id}/read", {
                    params: { path: { tenant, id: channel } },
                    body: { at: newest },
                })
                .catch(() => {});
        }
    }, [tenant, channel, newest]);
}
