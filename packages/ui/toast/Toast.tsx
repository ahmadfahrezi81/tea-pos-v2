import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { useRef, useSyncExternalStore } from "react";

export type ToastKind = "success" | "error" | "warning" | "info";

interface Toast {
    id: number;
    text: string;
    kind: ToastKind;
    detail?: string;
    action?: { label: string; onClick: () => void };
}

const ICONS: Record<ToastKind, [LucideIcon, string]> = {
    success: [CircleCheck, "text-green-600"],
    error: [CircleX, "text-red-600"],
    warning: [TriangleAlert, "text-amber-500"],
    info: [Info, "text-blue-600"],
};

let current: Toast | null = null;
let timer = 0;
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
    timer = window.setTimeout(() => dismiss(id), options.ms ?? (kind === "error" ? 6000 : 3000));
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
    const [Icon, color] = ICONS[t.kind];
    return (
        <div
            className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem_+_env(safe-area-inset-top))] z-[60] flex justify-center px-4"
            role={t.kind === "error" ? "alert" : "status"}
            aria-live={t.kind === "error" ? "assertive" : "polite"}
        >
            <div
                key={t.id}
                onPointerDown={(e) => (startY.current = e.clientY)}
                onPointerUp={(e) => e.clientY - startY.current < -20 && dismiss()}
                onClick={() => !t.action && dismiss()}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-black/5 animate-drop-in"
            >
                <Icon size={20} strokeWidth={2.5} className={`mt-px shrink-0 ${color}`} />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{t.text}</p>
                    {(t.detail || t.action) && (
                        <div className="mt-0.5 flex items-baseline justify-between gap-3">
                            <p className="min-w-0 text-sm text-gray-600">{t.detail}</p>
                            {t.action && (
                                <button
                                    onClick={() => {
                                        dismiss();
                                        t.action!.onClick();
                                    }}
                                    className="shrink-0 text-sm font-semibold text-gray-900 active:opacity-60"
                                >
                                    {t.action.label} ›
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
