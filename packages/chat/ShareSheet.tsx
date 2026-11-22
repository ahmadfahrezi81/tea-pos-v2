import { api } from "@tea-pos/api-client";
import { useChatChannels } from "@tea-pos/api-client/chat";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useSlug } from "@tea-pos/shell/tenant";
import { useApiMutation } from "@tea-pos/shell/useApiMutation";
import { ActionButton } from "@tea-pos/ui/ActionButton";
import { TextInput } from "@tea-pos/ui/form/TextInput";
import { SearchBox } from "@tea-pos/ui/SearchBox";
import { Sheet } from "@tea-pos/ui/Sheet";
import { toast } from "@tea-pos/ui/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";

import { channelName, KIND_ICON } from "./labels";

export type ShareLink = { kind: "day" | "pay_period" | "payout"; id: string };

/**
 * Share a backoffice screen into one of my chats (Step 75): pick the chat, add a message if
 * wanted, send. The toast after it opens that chat.
 */
export default function ShareSheet({
    link,
    open,
    onClose,
}: {
    link: ShareLink;
    open: boolean;
    onClose: () => void;
}) {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const channels = useChatChannels(slug).data?.channels ?? [];
    const [q, setQ] = useState("");
    const [picked, setPicked] = useState("");
    const [text, setText] = useState("");
    const share = useApiMutation(async (body: { channel: string; text: string }, headers) => {
        const { data, error } = await api.POST("/tenants/{tenant}/chat/channels/{id}/messages", {
            params: { path: { tenant: slug, id: body.channel } },
            headers,
            body: { body: body.text, link },
        });
        if (error) throw error;
        return data;
    });

    // Where I can write: my chats, not the app's own inbox, nothing read only.
    const mine = channels.filter((c) => c.mine && !c.readOnly);
    const needle = q.trim().toLocaleLowerCase(locale);
    const shown = needle
        ? mine.filter((c) => channelName(c, t).toLocaleLowerCase(locale).includes(needle))
        : mine;

    return (
        <Sheet open={open} onClose={onClose} title={t("chat.shareTo")}>
            <div className="chat space-y-3 pb-2">
                <SearchBox
                    value={q}
                    onChange={setQ}
                    placeholder={t("chat.search")}
                    clearLabel={t("common.close")}
                />
                <div className="max-h-[45vh] overflow-y-auto rounded-xl bg-white">
                    {shown.map((c) => {
                        const Icon = KIND_ICON[c.kind];
                        return (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setPicked(c.id)}
                                className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-gray-100"
                            >
                                <span className="flex size-9 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                                    <Icon size={18} />
                                </span>
                                <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-gray-900">
                                    {channelName(c, t)}
                                </span>
                                {picked === c.id && <Check size={20} className="text-brand" />}
                            </button>
                        );
                    })}
                </div>
                <TextInput value={text} onChange={setText} placeholder={t("chat.shareMessage")} />
                <ActionButton
                    disabled={!picked}
                    action={async () => {
                        await share.mutateAsync({ channel: picked, text: text.trim() });
                        const c = mine.find((x) => x.id === picked);
                        void queryClient.invalidateQueries({
                            predicate: (x) =>
                                String(x.queryKey[1] ?? "").includes("/chat/") ||
                                x.queryKey[0] === "chat-messages",
                        });
                        onClose();
                        setPicked("");
                        setText("");
                        toast(t("chat.sharedTo").replace("{name}", c ? channelName(c, t) : ""), {
                            kind: "success",
                            action: {
                                label: t("chat.open"),
                                onClick: () => void navigate({ to: `/${slug}/chats/${picked}` }),
                            },
                        });
                    }}
                    className="w-full rounded-xl bg-brand py-3 text-[16px] font-semibold text-white disabled:opacity-40"
                >
                    {t("chat.send")}
                </ActionButton>
            </div>
        </Sheet>
    );
}
