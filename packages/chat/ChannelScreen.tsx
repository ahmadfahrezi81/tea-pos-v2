import { api } from "@tea-pos/api-client";
import { useMe } from "@tea-pos/api-client/me";
import { addDays, formatDate, formatTime, localDate } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { FooterSlot } from "@tea-pos/shell/FooterSlotContext";
import { HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { useSlug } from "@tea-pos/shell/tenant";
import { Avatar } from "@tea-pos/ui/Avatar";
import { ImagePreview } from "@tea-pos/ui/ImagePreview";
import { Sheet } from "@tea-pos/ui/Sheet";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCheck, Clock, SendHorizontal, X } from "lucide-react";
import {
    Fragment,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";

import { channelName } from "./labels";
import { forget, retry, send, snapshot, subscribe, type Pending } from "./outbox";
import { loadEarlier, useChannel, useThread, type ChatMessage } from "./queries";

type Member = { id: string; name: string; avatar?: string; readAt?: string };

/** How often, at most, the phone says how far it has read. */
const READ_EVERY_MS = 5000;
const MAX_LENGTH = 4000;

/** One channel: messages newest at the bottom, the box to write in (RFC: Chat (v2), screen 2). */
export default function ChannelScreen({ channelId }: { channelId: string }) {
    const t = useT();
    const slug = useSlug();
    const me = useMe().data?.user.id ?? "";
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
    const bottom = useStickToBottom(items.length + waiting.length);
    const [seenOf, setSeenOf] = useState<ChatMessage | null>(null);

    if (!channel || !thread.data)
        return (
            <div className="space-y-3">
                <Skeleton className="h-14 rounded-2xl w-2/3" />
                <Skeleton className="h-14 rounded-2xl w-1/2 ml-auto" />
                <Skeleton className="h-14 rounded-2xl w-3/4" />
            </div>
        );

    const others = channel.members.filter((m) => m.id !== me);
    const lastMine = [...items].reverse().find((m) => m.authorId === me);
    const firstNew = items.find(
        (m) => m.authorId !== me && readAtOpen !== null && m.at > readAtOpen,
    )?.id;

    return (
        <div className="space-y-1 pb-2">
            <HeaderTitle>{channelName(channel, t)}</HeaderTitle>
            {thread.data.next && <EarlierButton channelId={channelId} />}
            {items.length === 0 && waiting.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-500">{t("chat.noMessages")}</p>
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
                    />
                </Fragment>
            ))}
            {waiting.map((p) => (
                <Outgoing key={p.key} p={p} slug={slug} />
            ))}
            <div ref={bottom} />
            <Composer channelId={channelId} readOnly={channel.readOnly} kind={channel.kind} />
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

function DayLine({ at }: { at: string }) {
    const t = useT();
    const locale = useLocale();
    const day = localDate(at);
    const today = localDate();
    const yesterday = addDays(today, -1);
    const label =
        day === today
            ? t("chat.today")
            : day === yesterday
              ? t("chat.yesterday")
              : formatDate(at, locale);
    return (
        <div className="flex justify-center py-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600">
                {label}
            </span>
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

function Message({
    m,
    mine,
    grouped,
    seen,
    onSeen,
}: {
    m: ChatMessage;
    mine: boolean;
    grouped: boolean;
    seen?: number;
    onSeen: () => void;
}) {
    const t = useT();
    const locale = useLocale();
    if (m.event)
        return (
            <div className="flex justify-center py-1">
                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-gray-700">
                    {systemText(m, t)} · {formatTime(m.at, locale)}
                </span>
            </div>
        );
    const text = m.deleted ? (
        <span className="italic text-gray-500">{t("chat.deleted")}</span>
    ) : (
        m.body
    );
    if (mine)
        return (
            <div className={`flex flex-col items-end gap-1 ${grouped ? "" : "pt-2"}`}>
                {!m.deleted && m.photos?.length ? <Photos photos={m.photos} mine /> : null}
                {(m.body || m.deleted) && (
                    <button
                        onClick={onSeen}
                        className="max-w-[80%] rounded-2xl rounded-br-md bg-brand px-3 py-2 text-left text-[15px] text-white whitespace-pre-wrap break-words active:opacity-80"
                    >
                        {text}
                    </button>
                )}
                <span className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                    {formatTime(m.at, locale)}
                    {seen !== undefined && seen > 0 && (
                        <button onClick={onSeen} className="flex items-center gap-1 text-brand">
                            · {t("chat.seenBy").replace("{n}", String(seen))}
                            <CheckCheck size={13} strokeWidth={2.5} />
                        </button>
                    )}
                </span>
            </div>
        );
    return (
        <div className={`flex items-end gap-2 ${grouped ? "" : "pt-2"}`}>
            <span className="w-8 shrink-0">{!grouped && <Avatar url={m.avatar} size={32} />}</span>
            <div className="max-w-[78%]">
                {!grouped && <p className="px-1 text-xs font-semibold text-gray-700">{m.author}</p>}
                {!m.deleted && m.photos?.length ? (
                    <div className="py-0.5">
                        <Photos photos={m.photos} mine={false} />
                    </div>
                ) : null}
                {(m.body || m.deleted) && (
                    <div className="rounded-2xl rounded-bl-md bg-white px-3 py-2 text-[15px] text-gray-900 whitespace-pre-wrap break-words">
                        {text}
                    </div>
                )}
                <span className="px-1 text-[11px] text-gray-500">{formatTime(m.at, locale)}</span>
            </div>
        </div>
    );
}

/** A system message in the reader's language; an event this build does not know shows its body. */
function systemText(m: ChatMessage, t: (key: MessageKey) => string): string {
    void t;
    return m.body || m.event || "";
}

function Outgoing({ p, slug }: { p: Pending; slug: string }) {
    const t = useT();
    const locale = useLocale();
    const queryClient = useQueryClient();
    const failed = p.state === "failed";
    return (
        <div className="flex flex-col items-end gap-1 pt-2">
            {p.photos.length > 0 && (
                <div
                    className={`grid gap-1 ${p.photos.length === 1 ? "grid-cols-1 w-56" : "grid-cols-2 w-60"} ${failed ? "" : "opacity-70"}`}
                >
                    {p.photos.map((ph) => (
                        <img
                            key={ph.local}
                            src={ph.local}
                            alt=""
                            className="block w-full rounded-xl object-cover aspect-square"
                        />
                    ))}
                </div>
            )}
            {p.body && (
                <button
                    disabled={!failed}
                    onClick={() => retry(queryClient, slug, p.key)}
                    className={`max-w-[80%] rounded-2xl rounded-br-md px-3 py-2 text-left text-[15px] text-white whitespace-pre-wrap break-words ${failed ? "bg-red-500" : "bg-brand/70"}`}
                >
                    {p.body}
                </button>
            )}
            {failed ? (
                <span className="mt-0.5 flex items-center gap-3 text-[11px]">
                    <button
                        onClick={() => retry(queryClient, slug, p.key)}
                        className="font-semibold text-red-600"
                    >
                        {t("chat.notSent")}
                    </button>
                    <button onClick={() => forget(p.key)} className="text-gray-500">
                        {t("chat.delete")}
                    </button>
                </span>
            ) : (
                <span className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500">
                    {formatTime(p.at, locale)}
                    <Clock size={12} />
                </span>
            )}
        </div>
    );
}

function EarlierButton({ channelId }: { channelId: string }) {
    const t = useT();
    const slug = useSlug();
    const queryClient = useQueryClient();
    const [busy, setBusy] = useState(false);
    return (
        <div className="flex justify-center py-2">
            <button
                disabled={busy}
                onClick={() => {
                    setBusy(true);
                    void loadEarlier(queryClient, slug, channelId).finally(() => setBusy(false));
                }}
                className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-brand active:opacity-70 disabled:opacity-50"
            >
                {t("chat.earlier")}
            </button>
        </div>
    );
}

/** The white bar at the bottom: the message and send; a note instead where nobody posts. */
/** At most this many photos in one message. */
const MAX_PHOTOS = 4;

function Composer({
    channelId,
    readOnly,
    kind,
}: {
    channelId: string;
    readOnly: boolean;
    kind: string;
}) {
    const t = useT();
    const slug = useSlug();
    const queryClient = useQueryClient();
    const [text, setText] = useState("");
    const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
    const box = useRef<HTMLTextAreaElement>(null);
    const picker = useRef<HTMLInputElement>(null);
    const body = text.trim();
    const ready = (body !== "" || photos.length > 0) && body.length <= MAX_LENGTH;
    const submit = () => {
        if (!ready) return;
        send(
            queryClient,
            slug,
            channelId,
            body,
            photos.map((p) => p.file),
        );
        photos.forEach((p) => URL.revokeObjectURL(p.url));
        setPhotos([]);
        setText("");
        if (box.current) box.current.style.height = "auto";
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
            <div className="bg-white border-t border-gray-200 px-3 py-2">
                {readOnly ? (
                    <p className="py-2 text-center text-sm text-gray-500">
                        {t(kind === "personal" ? "chat.readOnly" : "chat.storeClosed")}
                    </p>
                ) : (
                    <>
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
                        <div className="flex items-end gap-2">
                            <button
                                onClick={() => picker.current?.click()}
                                disabled={photos.length >= MAX_PHOTOS}
                                aria-label={t("chat.photo")}
                                className="flex size-10 shrink-0 items-center justify-center rounded-full text-brand disabled:opacity-40 active:scale-95"
                            >
                                <Camera size={24} />
                            </button>
                            <input
                                ref={picker}
                                type="file"
                                accept="image/*"
                                multiple
                                hidden
                                onChange={(e) => {
                                    pick(e.target.files);
                                    e.target.value = "";
                                }}
                            />
                            <textarea
                                ref={box}
                                rows={1}
                                value={text}
                                maxLength={MAX_LENGTH}
                                onChange={(e) => {
                                    setText(e.target.value);
                                    // Grows with the text, up to about five lines.
                                    e.target.style.height = "auto";
                                    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                                }}
                                placeholder={t("chat.message")}
                                className="flex-1 resize-none rounded-2xl bg-slate-100 px-3 py-2.5 text-[16px] leading-5 outline-none"
                            />
                            <button
                                onClick={submit}
                                disabled={!ready}
                                aria-label={t("chat.send")}
                                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:opacity-40 active:scale-95"
                            >
                                <SendHorizontal size={20} />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </FooterSlot>
    );
}

/** A message's photos: previews only, the space kept before they load; a tap opens the full one. */
function Photos({
    photos,
    mine,
}: {
    photos: { url: string; previewUrl: string; width: number; height: number }[];
    mine: boolean;
}) {
    const t = useT();
    const [open, setOpen] = useState<string | null>(null);
    const one = photos.length === 1;
    return (
        <>
            <div
                className={`grid gap-1 ${one ? "grid-cols-1 w-56" : "grid-cols-2 w-60"} ${mine ? "ml-auto" : ""}`}
            >
                {photos.map((p, i) => (
                    <button
                        key={i}
                        onClick={() => p.url && setOpen(p.url)}
                        className="overflow-hidden rounded-xl bg-slate-200"
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

/** Opens at the newest message, and follows new ones while the reader is already at the bottom. */
function useStickToBottom(count: number) {
    const end = useRef<HTMLDivElement>(null);
    const first = useRef(true);
    useLayoutEffect(() => {
        const scroller = document.getElementById("shell-scroll");
        if (!scroller || !end.current || count === 0) return;
        const near = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 200;
        if (first.current || near) end.current.scrollIntoView({ block: "end" });
        first.current = false;
    }, [count]);
    return end;
}
