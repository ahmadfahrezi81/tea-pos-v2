import { Search, X } from "lucide-react";

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
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5">
            <Search size={16} className="text-gray-400 shrink-0" />
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
                    className="text-gray-400 active:text-gray-600 shrink-0"
                    aria-label={clearLabel}
                >
                    <X size={16} />
                </button>
            )}
        </div>
    );
}
