import { Check } from "lucide-react";

export type Choice<T extends string> = {
    value: T;
    label: string;
    sublabel?: string;
    disabled?: boolean;
};

/** Pick one, as the old seller app's language list: a row each, a filled circle on the chosen. */
export function ChoiceList<T extends string>({
    choices,
    value,
    onChange,
}: {
    choices: Choice<T>[];
    value: T;
    onChange: (value: T) => void;
}) {
    return (
        <div className="bg-white in-[.panel]:bg-slate-100 rounded-2xl in-[.panel]:rounded-xl px-4 py-1">
            {choices.map((c) => {
                const selected = c.value === value;
                return (
                    <button
                        key={c.value}
                        onClick={() => onChange(c.value)}
                        disabled={selected || c.disabled}
                        className="w-full flex items-center justify-between gap-3 py-5 border-b-2 last:border-b-0 border-slate-100 in-[.panel]:border-white active:bg-gray-50 disabled:active:bg-transparent"
                    >
                        <div className={`text-left ${c.disabled ? "opacity-40" : ""}`}>
                            <p className="text-[17px] font-medium text-gray-900">{c.label}</p>
                            {c.sublabel && (
                                <p className="text-sm text-gray-400 in-[.panel]:text-gray-900">
                                    {c.sublabel}
                                </p>
                            )}
                        </div>
                        <span
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-brand/90 bg-brand/90" : "border-gray-300"}`}
                        >
                            {selected && <Check size={16} className="text-white" strokeWidth={4} />}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
