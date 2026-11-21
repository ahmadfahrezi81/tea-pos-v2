import { loadArea } from "@tea-pos/i18n";
import { HeaderActions } from "@tea-pos/shell/HeaderActions";
import { useTenant } from "@tea-pos/shell/tenant";
import { lazy, Suspense, useState } from "react";

import type { ShareLink } from "./ShareSheet";

// The sheet and chat's words load only when Share is tapped.
const ShareSheet = lazy(async () => {
    await loadArea("chat");
    return import("./ShareSheet");
});

/** Share in a screen's header, for anyone with chat (Step 75). */
export function ShareAction({ link }: { link: ShareLink }) {
    const hasChat = !!useTenant()?.tenant.access.chat;
    const [open, setOpen] = useState(false);
    const [asked, setAsked] = useState(false);
    if (!hasChat) return null;
    return (
        <>
            <HeaderActions
                actions={[
                    {
                        kind: "share",
                        onClick: () => {
                            setAsked(true);
                            setOpen(true);
                        },
                    },
                ]}
            />
            {asked && (
                <Suspense fallback={null}>
                    <ShareSheet link={link} open={open} onClose={() => setOpen(false)} />
                </Suspense>
            )}
        </>
    );
}
