import type { ReactNode } from "react";

/** The old seller app's big switch: a wide knob that slides; `icon` sits inside the knob. */
export function Switch({
    on,
    onChange,
    label,
    icon,
}: {
    on: boolean;
    onChange: (on: boolean) => void;
    label: string;
    icon?: ReactNode;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={label}
            onClick={() => onChange(!on)}
            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${on ? "bg-brand" : "bg-gray-300"}`}
        >
            <span
                className={`inline-flex h-7 w-9 items-center justify-center rounded-full bg-white shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`}
            >
                {icon}
            </span>
        </button>
    );
}
