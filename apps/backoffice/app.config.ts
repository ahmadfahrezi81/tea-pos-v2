import { defineApp } from "@tea-pos/config/app";

export default defineApp({
    id: "backoffice",
    name: "Tea POS Backoffice",
    shortName: "Backoffice",
    description: "Admin backoffice for Tea POS",
    // orange-600, so it is obvious at a glance which app is on screen
    brand: "oklch(0.646 0.222 41.116)",
    signIn: {
        logo: "/icons/icon-192x192.png",
        titleKey: "signIn.backofficeTitle",
        subtitleKey: "signIn.backofficeSub",
    },
    locales: ["en"],
    stores: "all",
});
