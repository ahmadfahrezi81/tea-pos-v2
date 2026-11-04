import { defineApp } from "@tea-pos/config/app";

export default defineApp({
    id: "seller",
    name: "Tea-POS",
    shortName: "Tea-POS",
    description: "Tea-POS by Lykos Tech: orders and sales at the stand.",
    // blue-600
    brand: "oklch(0.546 0.245 262.881)",
    signIn: {
        logo: "/LEMONI-512x512.png",
        titleKey: "signIn.sellerTitle",
        subtitleKey: "signIn.sellerSub",
    },
    locales: ["en", "id"],
    stores: "one",
});
