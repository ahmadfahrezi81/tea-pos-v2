import { defineApp } from "@tea-pos/config/app";

export default defineApp({
    id: "seller",
    name: "Tea-Seller",
    shortName: "Tea-Seller",
    description: "Tea-Seller by Lykos Tech: orders and sales at the stand.",
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
