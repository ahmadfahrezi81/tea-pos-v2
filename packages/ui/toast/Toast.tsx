import { useSyncExternalStore } from "react";

interface Toast {
    id: number;
    text: string;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/** A short message at the bottom for a few seconds: an error that belongs to no field, a saved. */
export function toast(text: string, ms = 4000) {
    const id = nextId++;
    toasts = [...toasts, { id, text }];
    emit();
    setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== id);
        emit();
    }, ms);
}

/** Mounted once, by the shell. */
export function ToastHost() {
    const list = useSyncExternalStore(
        (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        () => toasts,
    );
    if (!list.length) return null;
    return (
        <div
            className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4"
            role="status"
            aria-live="polite"
        >
            {list.map((t) => (
                <p
                    key={t.id}
                    className="max-w-sm rounded-xl bg-gray-900/90 px-4 py-3 text-sm text-white shadow-lg"
                >
                    {t.text}
                </p>
            ))}
        </div>
    );
}
