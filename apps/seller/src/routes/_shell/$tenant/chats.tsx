import { loadArea } from "@tea-pos/i18n";
import ChatsScreen from "@tea-pos/chat/ChatsScreen";
import { createFileRoute } from "@tanstack/react-router";

// Chat loads only when opened: the first screen stays the size it was (RFC: Chat (v2)).
export const Route = createFileRoute("/_shell/$tenant/chats")({
    staticData: { shell: { titleKey: "nav.chats", parent: null } },
    loader: () => loadArea("chat"),
    component: ChatsScreen,
});
