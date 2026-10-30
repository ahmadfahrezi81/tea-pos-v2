import { HelpTopics } from "../HelpTopics";

/** How pay works: periods, reviewing, paying and the setup, in plain words. */
export function PayHelp() {
    return <HelpTopics area="pay" topics={["Period", "Review", "Paying", "Setup"]} />;
}
