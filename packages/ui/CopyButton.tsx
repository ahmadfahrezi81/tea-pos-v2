import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";

/** Copies `value`; shows what it holds (children, if any) and a tick for a moment after. */
export function CopyButton({
    value,
    children,
    size = 14,
    label,
    className = "flex items-center gap-1.5 active:opacity-70",
    onCopied,
    onFailed,
}: {
    value: string;
    children?: ReactNode;
    size?: number;
    /** For screen readers when there are no children. */
    label?: string;
    className?: string;
    onCopied?: () => void;
    onFailed?: () => void;
}) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() =>
                void navigator.clipboard.writeText(value).then(() => {
                    setCopied(true);
                    onCopied?.();
                    setTimeout(() => setCopied(false), 2000);
                }, onFailed)
            }
            className={className}
            aria-label={children ? undefined : label}
        >
            {children}
            {copied ? (
                <Check size={size} className="shrink-0 text-green-500" />
            ) : (
                <Copy size={size} className="shrink-0 text-gray-400" />
            )}
        </button>
    );
}
