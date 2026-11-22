import { loadArea } from "@tea-pos/i18n";
import ChannelInfoScreen from "@tea-pos/chat/ChannelInfoScreen";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/$tenant/chats/$channelId_/info")({
    staticData: { shell: { titleKey: "chat.info", parent: ".." } },
    loader: () => loadArea("chat"),
    component: function Screen() {
        return <ChannelInfoScreen channelId={Route.useParams().channelId} />;
    },
});
