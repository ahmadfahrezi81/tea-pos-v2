import { Search, X } from "lucide-react";
import { ICON } from "./icon";

/** The old apps' search box above a list: a magnifier, the field, a clear button once typed. */
export function SearchBox({
    value,
    onChange,
    placeholder,
    clearLabel,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    clearLabel: string;
}) {
    return (
        <div className="flex items-center gap-2.5 bg-white rounded-xl px-3.5 py-3.5">
            <Search size={ICON} className="text-gray-400 shrink-0" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="flex-1 text-base text-gray-800 placeholder:text-gray-400 bg-transparent outline-none"
            />
            {value && (
                <button
                    onClick={() => onChange("")}
                    className="size-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center shrink-0 active:bg-gray-300"
                    aria-label={clearLabel}
                >
                    <X size={14} strokeWidth={2.5} />
                </button>
            )}
        </div>
    );
}
