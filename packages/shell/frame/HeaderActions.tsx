import { Link, useLocation } from "@tanstack/react-router";
import { useT } from "@tea-pos/i18n/react";
import { CirclePlus, MoreHorizontal, Pencil, type LucideIcon } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useAccess } from "../session/tenant";

import type { MessageKey } from "@tea-pos/i18n";
import { ICON } from "@tea-pos/ui/icon";

/** The header's right slot and title slot. Null until the shell has mounted. */
export const HeaderSlotContext = createContext<HTMLElement | null>(null);
export const HeaderTitleSlotContext = createContext<HTMLElement | null>(null);

/** A title from data (a store's name) in place of the route's, while the screen is on. */
export function HeaderTitle({ children }: { children: string }) {
    const target = useContext(HeaderTitleSlotContext);
    useEffect(() => {
        if (!target) return;
        target.classList.add("is-occupied");
        return () => target.classList.remove("is-occupied");
    }, [target]);
    return target ? createPortal(children, target) : null;
}

/** The fixed set: each kind is one icon with one meaning in every app. */
const KINDS = {
    add: { icon: CirclePlus, labelKey: "shell.add", writes: true },
    edit: { icon: Pencil, labelKey: "shell.edit", writes: true },
} satisfies Record<string, { icon: LucideIcon; labelKey: MessageKey; writes: boolean }>;

export type HeaderAction = { kind: keyof typeof KINDS } &
    /** A path; without a leading slash, under this screen (`"add"`). */
    ({ to: string; onClick?: never } | { onClick: () => void; to?: never });

function useHref(to: string | undefined): string | undefined {
    const pathname = useLocation({ select: (l) => l.pathname });
    if (to === undefined || to.startsWith("/")) return to;
    return `${pathname.replace(/\/$/, "")}/${to}`;
}

const button =
    "w-10 h-10 rounded-xl flex items-center justify-center text-gray-900 active:scale-95";
// Words, not icons: "Add" and "Edit" read at a glance.
const labelButton = "rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white active:scale-95";

/**
 * A screen's actions in the header's right slot: at most two show, more go
 * into a ⋯ menu; add and edit are hidden from a guest. A portal, as FooterSlot,
 * so the shell never holds a page's node.
 */
export function HeaderActions({ actions: all }: { actions: HeaderAction[] }) {
    const target = useContext(HeaderSlotContext);
    const { canWrite } = useAccess();
    const actions = all.filter((a) => canWrite || !KINDS[a.kind].writes);
    if (!target || actions.length === 0) return null;
    const shown = actions.length > 2 ? actions.slice(0, 1) : actions;
    const rest = actions.length > 2 ? actions.slice(1) : [];
    return createPortal(
        <>
            {shown.map((a) => (
                <Action key={a.kind} action={a} />
            ))}
            {rest.length > 0 && <Overflow actions={rest} />}
        </>,
        target,
    );
}

function Action({ action }: { action: HeaderAction }) {
    const t = useT();
    const href = useHref(action.to);
    const label = t(KINDS[action.kind].labelKey);
    if (href !== undefined)
        return (
            <Link to={href} className={labelButton}>
                {label}
            </Link>
        );
    return (
        <button onClick={action.onClick} className={labelButton}>
            {label}
        </button>
    );
}

function Overflow({ actions }: { actions: HeaderAction[] }) {
    const t = useT();
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                className={button}
                aria-label={t("shell.moreActions")}
                aria-expanded={open}
            >
                <MoreHorizontal size={26} strokeWidth={2.25} />
            </button>
            {open && (
                <>
                    <button
                        className="fixed inset-0 z-40 cursor-default"
                        aria-hidden
                        tabIndex={-1}
                        onClick={() => setOpen(false)}
                    />
                    <div className="absolute right-0 top-11 z-50 min-w-44 origin-top-right rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/5 animate-drop-in">
                        {actions.map((a) => (
                            <MenuItem key={a.kind} action={a} onDone={() => setOpen(false)} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function MenuItem({ action, onDone }: { action: HeaderAction; onDone: () => void }) {
    const t = useT();
    const { icon: Icon, labelKey } = KINDS[action.kind];
    const href = useHref(action.to);
    const row =
        "flex w-full items-center gap-3 px-4 py-3 text-left text-gray-900 active:bg-gray-100";
    const content = (
        <>
            <Icon size={ICON} />
            {t(labelKey)}
        </>
    );
    if (href !== undefined)
        return (
            <Link to={href} className={row} onClick={onDone}>
                {content}
            </Link>
        );
    return (
        <button
            className={row}
            onClick={() => {
                onDone();
                action.onClick?.();
            }}
        >
            {content}
        </button>
    );
}
