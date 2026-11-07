import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { useRef, useSyncExternalStore } from "react";

export type ToastKind = "success" | "error" | "warning" | "info";

interface Toast {
    id: number;
    text: string;
    kind: ToastKind;
    detail?: string;
    action?: { label: string; onClick: () => void };
    /** Sliding back up, just before it goes. */
    leaving?: boolean;
}

// As the old apps: the kind's colour filled, white text and icon.
const KINDS: Record<ToastKind, [LucideIcon, string]> = {
    success: [CheckCircle2, "bg-green-500"],
    error: [AlertCircle, "bg-red-500"],
    warning: [AlertTriangle, "bg-amber-400"],
    info: [Info, "bg-blue-500"],
};

let current: Toast | null = null;
let timer = 0;
let leaveTimer = 0;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function dismiss(id?: number) {
    if (id !== undefined && current?.id !== id) return;
    current = null;
    emit();
}

/**
 * A short message at the top, as the old apps: its kind's icon, a line, an optional second line
 * and action. A new one replaces the last, so they never pile up; errors stay longer.
 */
export function toast(
    text: string,
    options: {
        kind?: ToastKind;
        detail?: string;
        action?: { label: string; onClick: () => void };
        ms?: number;
    } = {},
) {
    const kind = options.kind ?? "info";
    const id = nextId++;
    current = { id, text, kind, detail: options.detail, action: options.action };
    emit();
    clearTimeout(timer);
    clearTimeout(leaveTimer);
    const ms = options.ms ?? (kind === "error" ? 6000 : 4000);
    leaveTimer = window.setTimeout(() => {
        if (current?.id !== id) return;
        current = { ...current, leaving: true };
        emit();
    }, ms - 300);
    timer = window.setTimeout(() => dismiss(id), ms);
}

/** Mounted once, by the shell. A tap, or a swipe up, puts it away. */
export function ToastHost() {
    const t = useSyncExternalStore(
        (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        () => current,
    );
    const startY = useRef(0);
    if (!t) return null;
    const [Icon, bg] = KINDS[t.kind];
    return (
        <div
            className="pointer-events-none fixed inset-x-4 top-[calc(1.5rem_+_env(safe-area-inset-top))] z-[60] flex justify-center"
            role={t.kind === "error" ? "alert" : "status"}
            aria-live={t.kind === "error" ? "assertive" : "polite"}
        >
            <div
                key={t.id}
                onPointerDown={(e) => (startY.current = e.clientY)}
                onPointerUp={(e) => e.clientY - startY.current < -20 && dismiss()}
                onClick={() => !t.action && dismiss()}
                className={`pointer-events-auto flex w-full max-w-[448px] items-center gap-2.5 rounded-2xl p-3 text-base font-semibold text-white shadow-lg ${t.leaving ? "animate-slide-up" : "animate-slide-down"} ${bg}`}
            >
                <Icon size={24} className="shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col">
                    <span>{t.text}</span>
                    {t.detail && <span className="text-sm font-medium">{t.detail}</span>}
                </div>
                {t.action && (
                    <button
                        onClick={() => {
                            dismiss();
                            t.action!.onClick();
                        }}
                        className="shrink-0 rounded-lg bg-white/20 px-2.5 py-1 text-sm font-semibold active:opacity-70"
                    >
                        {t.action.label} ›
                    </button>
                )}
            </div>
        </div>
    );
}
