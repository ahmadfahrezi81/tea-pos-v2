import { loadArea } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { HeaderActions } from "@tea-pos/shell/HeaderActions";
import { useTenant } from "@tea-pos/shell/tenant";
import { Share2 } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import type { ShareLink } from "./ShareSheet";

// The sheet and chat's words load only when Share is tapped.
const ShareSheet = lazy(async () => {
    await loadArea("chat");
    return import("./ShareSheet");
});

/**
 * Share, for anyone with chat (Step 75): in the screen's header, or (`inline`) a small icon in the
 * page, where a tab's root keeps its header for the account photo alone (task 077).
 */
export function ShareAction({ link, inline }: { link: ShareLink; inline?: boolean }) {
    const t = useT();
    const hasChat = !!useTenant()?.tenant.access.chat;
    const [open, setOpen] = useState(false);
    const [asked, setAsked] = useState(false);
    if (!hasChat) return null;
    const show = () => {
        setAsked(true);
        setOpen(true);
    };
    return (
        <>
            {inline ? (
                <button
                    type="button"
                    onClick={show}
                    aria-label={t("shell.share")}
                    className="-my-1.5 inline-flex size-7 items-center justify-center rounded-lg text-gray-600 active:bg-slate-100"
                >
                    <Share2 size={16} />
                </button>
            ) : (
                <HeaderActions actions={[{ kind: "share", onClick: show }]} />
            )}
            {asked && (
                <Suspense fallback={null}>
                    <ShareSheet link={link} open={open} onClose={() => setOpen(false)} />
                </Suspense>
            )}
        </>
    );
}
