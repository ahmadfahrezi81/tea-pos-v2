import { api } from "@tea-pos/api-client";
import { useT } from "@tea-pos/i18n/react";
import { useApiMutation } from "@tea-pos/shell/useApiMutation";
import { useSlug } from "@tea-pos/shell/tenant";
import { Drawer, DrawerHandle } from "@tea-pos/ui/Drawer";
import { toast } from "@tea-pos/ui/toast";
import { useQueryClient } from "@tanstack/react-query";
import {
    CheckCheck,
    Copy,
    CornerUpLeft,
    Pencil,
    RotateCw,
    Trash2,
    type LucideIcon,
} from "lucide-react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { threadKey, type ChatMessage, type Thread } from "./queries";
import { EMOJI } from "./labels";
import { withMentions } from "./mentions";

/** How long a finger rests on a message before its menu opens. */
const HOLD_MS = 450;
/** A finger that moves this far is scrolling, not holding. */
const SLOP = 10;

/**
 * A long press (or a right click) opens a message's menu; the tap that ends a hold does nothing
 * else (a photo under the finger does not open). The phone's own text menu is kept off.
 */
export function useHold(onHold: () => void) {
    const timer = useRef(0);
    const start = useRef<{ x: number; y: number } | null>(null);
    const fired = useRef(false);
    // A finger resting on it: the message sinks a little, so it shows it can be held.
    const [pressing, setPressing] = useState(false);
    const cancel = () => {
        clearTimeout(timer.current);
        start.current = null;
        setPressing(false);
    };
    const fire = () => {
        fired.current = true;
        setPressing(false);
        navigator.vibrate?.(15);
        onHold();
    };
    const handlers = {
        onPointerDown: (e: ReactPointerEvent) => {
            if (e.button !== 0) return;
            fired.current = false;
            start.current = { x: e.clientX, y: e.clientY };
            setPressing(true);
            timer.current = window.setTimeout(fire, HOLD_MS);
        },
        onPointerMove: (e: ReactPointerEvent) => {
            const s = start.current;
            if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > SLOP) cancel();
        },
        onPointerUp: cancel,
        onPointerCancel: cancel,
        onContextMenu: (e: React.MouseEvent) => {
            e.preventDefault();
            if (!fired.current) {
                cancel();
                fire();
            }
        },
        onClickCapture: (e: React.MouseEvent) => {
            if (!fired.current) return;
            fired.current = false;
            e.preventDefault();
            e.stopPropagation();
        },
    };
    return { handlers, pressing };
}

/** What a held message offers (RFC: Chat (v2), screen 6): reply, copy, Seen by, delete. */
export function MessageMenu({
    m,
    channelId,
    canReply,
    canDelete,
    canEdit,
    mine,
    onReply,
    onEdit,
    onReact,
    onSeen,
    onClose,
    names,
}: {
    m: ChatMessage;
    channelId: string;
    /** The channel's people: their @mentions lit in the preview, as in the bubble. */
    names: string[];
    canReply: boolean;
    canDelete: boolean;
    /** Mine, with text, sent less than 15 minutes ago. */
    canEdit: boolean;
    mine: boolean;
    onReply: () => void;
    onEdit: () => void;
    /** Absent where nobody posts. */
    onReact?: (emoji: string) => void;
    onSeen: () => void;
    onClose: () => void;
}) {
    const t = useT();
    const slug = useSlug();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(true);
    const [confirm, setConfirm] = useState(false);
    const close = (then?: () => void) => {
        setOpen(false);
        setTimeout(() => {
            onClose();
            then?.();
        }, 200);
    };
    const remove = useApiMutation(
        async (_: object, headers) => {
            const { error } = await api.DELETE(
                "/tenants/{tenant}/chat/channels/{id}/messages/{message}",
                { params: { path: { tenant: slug, id: channelId, message: m.id } }, headers },
            );
            if (error) throw error;
        },
        {
            onSuccess: () => {
                // Shown deleted at once; the live update brings everyone else's.
                queryClient.setQueryData<Thread>(threadKey(slug, channelId), (now) =>
                    now
                        ? {
                              ...now,
                              items: now.items.map((x) =>
                                  x.id === m.id
                                      ? { ...x, deleted: true, body: "", photos: undefined }
                                      : x,
                              ),
                          }
                        : now,
                );
                close();
            },
        },
    );
    const rows: [LucideIcon, string, () => void, boolean?][] = [];
    if (canReply)
        rows.push([
            CornerUpLeft,
            t("chat.reply"),
            // In the tap itself: the phone opens its keyboard only for a focus a finger caused.
            () => {
                onReply();
                close();
            },
        ]);
    if (canEdit)
        rows.push([
            Pencil,
            t("chat.edit"),
            () => {
                onEdit();
                close();
            },
        ]);
    if (m.body)
        rows.push([
            Copy,
            t("chat.copy"),
            () =>
                close(
                    () =>
                        void navigator.clipboard
                            ?.writeText(m.body)
                            .then(() => toast(t("chat.copied"), { kind: "success" }))
                            .catch(() => {}),
                ),
        ]);
    if (mine) rows.push([CheckCheck, t("chat.seenByTitle"), () => close(onSeen)]);
    if (canDelete) rows.push([Trash2, t("chat.delete"), () => setConfirm(true), true]);

    return (
        <Drawer
            open={open}
            onClose={() => close()}
            label={t("chat.message")}
            className="px-4 pt-5 pb-3"
        >
            <DrawerHandle />
            {confirm ? (
                <div className="chat space-y-4 pt-2">
                    <div>
                        <p className="text-xl font-bold text-gray-900">{t("chat.deleteConfirm")}</p>
                        <p className="mt-1 text-[15px] text-gray-600">{t("chat.deleteSub")}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => close()}
                            className="rounded-xl bg-slate-100 py-3 font-semibold text-gray-900 active:opacity-70"
                        >
                            {t("common.cancel")}
                        </button>
                        <button
                            disabled={remove.isPending}
                            onClick={() => remove.mutate({})}
                            className="rounded-xl bg-red-600 py-3 font-semibold text-white active:opacity-70 disabled:opacity-50"
                        >
                            {t("chat.delete")}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="chat space-y-3 pt-2">
                    {onReact && (
                        <div className="flex justify-between rounded-2xl bg-slate-100 px-2 py-1.5">
                            {EMOJI.map((e) => {
                                const on = !!m.reactions?.find((r) => r.emoji === e)?.mine;
                                return (
                                    <button
                                        key={e}
                                        onClick={() => {
                                            onReact(e);
                                            close();
                                        }}
                                        aria-pressed={on}
                                        className={`flex size-11 items-center justify-center rounded-full text-[26px] active:scale-90 transition-transform ${on ? "bg-brand/15" : ""}`}
                                    >
                                        {e}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {/* The held message as it is: its photos, its text. */}
                    <div className="rounded-xl bg-slate-100 p-1.5">
                        {!!m.photos?.length && (
                            <div className="flex gap-1">
                                {m.photos.map((p, i) => (
                                    <img
                                        key={i}
                                        src={p.previewUrl || undefined}
                                        alt=""
                                        className="size-20 rounded-lg bg-slate-200 object-cover"
                                    />
                                ))}
                            </div>
                        )}
                        {m.body && (
                            <p className="line-clamp-3 px-1.5 py-0.5 text-[15px] text-gray-700 whitespace-pre-wrap break-words">
                                {withMentions(m.body, names)}
                            </p>
                        )}
                    </div>
                    <div className="overflow-hidden rounded-2xl bg-slate-100">
                        {rows.map(([Icon, label, act, danger]) => (
                            <button
                                key={label}
                                onClick={act}
                                className={`flex w-full items-center gap-3 border-b border-white px-4 py-3.5 text-left text-[16px] font-medium last:border-b-0 active:bg-slate-200 ${danger ? "text-red-600" : "text-gray-900"}`}
                            >
                                <Icon size={20} className={danger ? "" : "text-brand"} />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </Drawer>
    );
}

/** A message that did not send: try again, or drop it. */
export function FailedMenu({
    onRetry,
    onDelete,
    onClose,
}: {
    onRetry: () => void;
    onDelete: () => void;
    onClose: () => void;
}) {
    const t = useT();
    const [open, setOpen] = useState(true);
    const close = (then?: () => void) => {
        setOpen(false);
        setTimeout(() => {
            onClose();
            then?.();
        }, 200);
    };
    return (
        <Drawer
            open={open}
            onClose={() => close()}
            label={t("chat.notSentShort")}
            className="px-4 pt-5 pb-3"
        >
            <DrawerHandle />
            <div className="chat space-y-3 pt-2">
                <p className="text-xl font-bold text-gray-900">{t("chat.notSentShort")}</p>
                <div className="overflow-hidden rounded-2xl bg-slate-100">
                    <button
                        onClick={() => close(onRetry)}
                        className="flex w-full items-center gap-3 border-b border-white px-4 py-3.5 text-left text-[16px] font-medium text-gray-900 active:bg-slate-200"
                    >
                        <RotateCw size={20} className="text-brand" />
                        {t("chat.retry")}
                    </button>
                    <button
                        onClick={() => close(onDelete)}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[16px] font-medium text-red-600 active:bg-slate-200"
                    >
                        <Trash2 size={20} />
                        {t("chat.delete")}
                    </button>
                </div>
            </div>
        </Drawer>
    );
}
