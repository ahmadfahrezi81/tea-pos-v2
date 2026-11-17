import { api } from "@tea-pos/api-client";
import { Sheet } from "@tea-pos/ui/Sheet";
import { toast } from "@tea-pos/ui/toast";
import type { QueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { EMOJI } from "./labels";
import { useHold } from "./menu";
import { threadKey, type ChatMessage, type Thread } from "./queries";

type Reaction = NonNullable<ChatMessage["reactions"]>[number];

/** Adds my reaction, or takes it back: shown at once, put back if Go refuses. */
export async function toggleReaction(
    queryClient: QueryClient,
    tenant: string,
    channel: string,
    m: ChatMessage,
    emoji: string,
    myName: string,
    failed: string,
) {
    const key = threadKey(tenant, channel);
    const before = queryClient.getQueryData<Thread>(key);
    const mine = !!m.reactions?.find((r) => r.emoji === emoji)?.mine;
    const next = (rs: Reaction[] = []): Reaction[] => {
        if (mine)
            return rs
                .map((r) =>
                    r.emoji === emoji
                        ? { ...r, mine: false, names: removeOnce(r.names, myName) }
                        : r,
                )
                .filter((r) => r.names.length > 0);
        return rs.some((r) => r.emoji === emoji)
            ? rs.map((r) =>
                  r.emoji === emoji ? { ...r, mine: true, names: [...r.names, myName] } : r,
              )
            : [...rs, { emoji, mine: true, names: [myName] }];
    };
    queryClient.setQueryData<Thread>(key, (now) =>
        now
            ? {
                  ...now,
                  items: now.items.map((x) =>
                      x.id === m.id ? { ...x, reactions: next(x.reactions ?? undefined) } : x,
                  ),
              }
            : now,
    );
    const path = { tenant, id: channel, message: m.id, emoji: emoji as (typeof EMOJI)[number] };
    const { error } = mine
        ? await api.DELETE(
              "/tenants/{tenant}/chat/channels/{id}/messages/{message}/reactions/{emoji}",
              { params: { path } },
          )
        : await api.PUT(
              "/tenants/{tenant}/chat/channels/{id}/messages/{message}/reactions/{emoji}",
              { params: { path } },
          );
    if (error) {
        queryClient.setQueryData(key, before);
        toast(failed, { kind: "error" });
    }
}

function removeOnce(names: string[], name: string) {
    const i = names.indexOf(name);
    return i < 0 ? names.slice(1) : [...names.slice(0, i), ...names.slice(i + 1)];
}

/** One emoji under a bubble: a tap adds or takes back mine; held, who used it. */
function Chip({
    r,
    onToggle,
    onWho,
}: {
    r: Reaction;
    onToggle: (emoji: string) => void;
    onWho: (r: Reaction) => void;
}) {
    const { handlers } = useHold(() => onWho(r));
    return (
        <button
            {...handlers}
            onClick={() => onToggle(r.emoji)}
            className={`flex h-6 select-none items-center gap-1 rounded-full px-2 text-[13px] leading-none ring-1 [-webkit-touch-callout:none] active:opacity-70 ${r.mine ? "bg-brand/10 text-brand ring-brand/40" : "bg-white text-gray-700 ring-slate-200"}`}
        >
            <span>{r.emoji}</span>
            {r.names.length > 1 && (
                <span className="font-semibold tabular-nums">{r.names.length}</span>
            )}
        </button>
    );
}

/** Under a bubble: each emoji and how many; mine lit; a tap adds or takes back mine. */
export function Reactions({
    reactions,
    mine: alignRight,
    onToggle,
}: {
    reactions: Reaction[];
    mine: boolean;
    onToggle: (emoji: string) => void;
}) {
    const [who, setWho] = useState<Reaction | null>(null);
    return (
        <>
            <span className={`-mt-0.5 flex flex-wrap gap-1 ${alignRight ? "justify-end" : ""}`}>
                {reactions.map((r) => (
                    <Chip key={r.emoji} r={r} onToggle={onToggle} onWho={setWho} />
                ))}
            </span>
            {who && (
                <Sheet open onClose={() => setWho(null)} title={who.emoji}>
                    <div className="pb-4">
                        {who.names.map((n, i) => (
                            <p
                                key={i}
                                className="border-b border-slate-100 py-2.5 text-[16px] text-gray-900 last:border-b-0"
                            >
                                {n}
                            </p>
                        ))}
                    </div>
                </Sheet>
            )}
        </>
    );
}
