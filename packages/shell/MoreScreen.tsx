import { useT } from "@tea-pos/i18n/react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Sparkles, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { useTenant } from "./tenant";
import { LATEST, seen } from "./whatsNew";

/** The More tab: what both apps share; each app adds its own entries later. */
export function MoreScreen() {
    const t = useT();
    const slug = useTenant()?.tenant.slug;
    if (!slug) return null;
    const unseen = LATEST !== "" && seen() !== LATEST;
    return (
        <ul className="rounded-2xl bg-white divide-y divide-gray-100">
            <Row to={`/${slug}/account`} icon={<UserRound size={18} />} label={t("more.account")} />
            <Row
                to={`/${slug}/whats-new`}
                icon={<Sparkles size={18} />}
                label={t("more.whatsNew")}
                dot={unseen}
            />
        </ul>
    );
}

export function Row({
    to,
    icon,
    label,
    dot,
}: {
    to: string;
    icon: ReactNode;
    label: string;
    dot?: boolean;
}) {
    return (
        <li>
            <Link to={to} className="flex items-center gap-3 p-4 text-gray-900">
                <span className="text-gray-500">{icon}</span>
                <span className="flex-1">{label}</span>
                {dot && <span className="size-2 rounded-full bg-brand" />}
                <ChevronRight size={18} className="text-gray-300" />
            </Link>
        </li>
    );
}
