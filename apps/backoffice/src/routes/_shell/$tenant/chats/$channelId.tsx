import { loadArea } from "@tea-pos/i18n";
import ChannelScreen from "@tea-pos/chat/ChannelScreen";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/$tenant/chats/$channelId")({
    staticData: { shell: { titleKey: "nav.chats", parent: "..", scrollPaddingBottom: "pb-2" } },
    loader: () => loadArea("chat"),
    component: function Screen() {
        return <ChannelScreen channelId={Route.useParams().channelId} />;
    },
});
