import { useT } from "@tea-pos/i18n/react";

import { errorMessage } from "../session/errors";

/** A screen whose data did not come: says so, rather than looking empty or loading for ever. */
export function LoadFailed({ error }: { error: unknown }) {
    const t = useT();
    return (
        <p className="bg-white rounded-2xl p-6 text-center text-sm text-gray-600">
            {errorMessage(t, error)}
        </p>
    );
}
