import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

/** The old apps' note in a form: an icon, a bold line, a sentence. */
export function Callout({
    icon = <AlertTriangle size={18} className="text-amber-600" />,
    title,
    children,
}: {
    icon?: ReactNode;
    title?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="mt-0.5 shrink-0">{icon}</span>
            <div className="min-w-0 space-y-0.5">
                {title && <p className="text-sm font-semibold text-slate-900">{title}</p>}
                <p className="text-sm text-slate-600">{children}</p>
            </div>
        </div>
    );
}
