import { Construction, type LucideIcon } from "lucide-react";

/** The old app's placeholder card for a screen not built yet. */
export function ComingSoon({
    title,
    subtitle,
    icon: Icon = Construction,
}: {
    title: string;
    subtitle?: string;
    icon?: LucideIcon;
}) {
    return (
        <div className="min-h-full bg-white rounded-2xl flex flex-col items-center justify-center py-24 text-gray-400 gap-4">
            <div className="size-24 rounded-full bg-gray-100 flex items-center justify-center">
                <Icon className="size-12 text-gray-400" />
            </div>
            <div className="text-center">
                <p className="text-sm font-medium text-gray-500">{title}</p>
                {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
        </div>
    );
}
