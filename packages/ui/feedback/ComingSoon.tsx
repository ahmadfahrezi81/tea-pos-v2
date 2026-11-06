import { Construction } from "lucide-react";

import { EmptyState } from "./EmptyState";

/** The old app's placeholder for a screen not built yet: the empty card, a whole screen tall. */
export function ComingSoon({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <EmptyState
            title={title}
            body={subtitle}
            icon={Construction}
            className="min-h-full py-24"
        />
    );
}
