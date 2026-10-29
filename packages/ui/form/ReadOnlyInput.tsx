import { Lock } from "lucide-react";
import { ICON } from "../icon";

/** A value shown in a field's shell but locked: the padlock is TextInput's pencil, locked. */
export function ReadOnlyInput({
    value,
    className = "text-xl font-bold",
}: {
    value: string;
    className?: string;
}) {
    return (
        <div className="flex items-center gap-2 p-4 px-3 border-2 border-gray-100 rounded-2xl bg-gray-50">
            <p className={`${className} text-gray-900 w-full min-w-0 truncate`}>{value}</p>
            <Lock size={ICON} strokeWidth={2.5} className="text-gray-400 shrink-0" />
        </div>
    );
}
