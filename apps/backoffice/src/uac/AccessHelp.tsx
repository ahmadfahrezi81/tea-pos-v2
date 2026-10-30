import { HelpTopics } from "../HelpTopics";

/** How access works: apps, levels, the owner, stores, inactive and requests, in plain words. */
export function AccessHelp() {
    return (
        <HelpTopics
            area="uac"
            topics={["OneAccount", "Seller", "Office", "Owner", "Stores", "Inactive", "Requests"]}
        />
    );
}
