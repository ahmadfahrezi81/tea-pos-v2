import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import { pickLocale } from "@tea-pos/i18n/pick";

import type { AppConfig } from "./app";

// The shell's header colour (slate-100): the status bar and the install splash match it.
const SHELL_COLOR = "#f1f5f9";

const contract = createHash("sha256")
    .update(readFileSync(new URL("../../api/openapi.yaml", import.meta.url)))
    .digest("hex")
    .slice(0, 12);

// The routes drawn on first open; the bundle-size check counts what this preloads.
const FIRST_SCREEN = [/src\/routes\/_shell\.tsx/, /src\/routes\/_shell\/index\.tsx/];

// Everything the first screen needs is requested with the main JavaScript, not after
// it runs: its route code and the font. The language is preloaded by pickLanguage below.
function preloadFirstScreen(): Plugin {
    return {
        name: "tea-pos:preload-first-screen",
        transformIndexHtml: {
            order: "post",
            handler(_html, ctx) {
                const tags = [];
                for (const file of Object.values(ctx.bundle ?? {})) {
                    if (file.type === "asset") {
                        if (/inter-latin-wght-normal.*\.woff2$/.test(file.fileName)) {
                            tags.push({
                                tag: "link",
                                attrs: {
                                    rel: "preload",
                                    href: `/${file.fileName}`,
                                    as: "font",
                                    type: "font/woff2",
                                    crossorigin: "",
                                },
                                injectTo: "head" as const,
                            });
                        }
                        continue;
                    }
                    const id = file.facadeModuleId ?? "";
                    if (FIRST_SCREEN.some((pattern) => pattern.test(id))) {
                        tags.push({
                            tag: "link",
                            attrs: { rel: "modulepreload", href: `/${file.fileName}` },
                            injectTo: "head" as const,
                        });
                    }
                }
                return tags;
            },
        },
    };
}

// Picks the language before any JavaScript loads (the same pickLocale the app uses)
// and preloads only that file; startApp reads the choice from <html data-locale>.
function pickLanguage(app: AppConfig): Plugin {
    return {
        name: "tea-pos:pick-language",
        transformIndexHtml: {
            order: "post",
            handler(_html, ctx) {
                const files: Record<string, string> = {};
                for (const file of Object.values(ctx.bundle ?? {})) {
                    const id = file.type === "chunk" ? (file.facadeModuleId ?? "") : "";
                    for (const locale of app.locales) {
                        if (id.endsWith(`/i18n/${locale}.json`))
                            files[locale] = `/${file.fileName}`;
                    }
                }
                const script =
                    `(function(){var l=(${String(pickLocale).replace(/\s+/g, " ")})(${JSON.stringify(app.locales)});` +
                    `var r=document.documentElement;r.dataset.locale=l;r.lang=l;` +
                    `var f=${JSON.stringify(files)}[l];if(f){var p=document.createElement("link");` +
                    `p.rel="modulepreload";p.href=f;document.head.appendChild(p)}})()`;
                return [{ tag: "script", children: script, injectTo: "head" }];
            },
        },
    };
}

// The stylesheet goes inside index.html: a <link> would hold the first paint, the
// splash included, for a whole round trip on slow 4G. The HTML is precached anyway.
function inlineCss(): Plugin {
    return {
        name: "tea-pos:inline-css",
        apply: "build",
        transformIndexHtml: {
            order: "post",
            handler(html, ctx) {
                return html.replace(
                    /<link rel="stylesheet"[^>]*href="\/([^"]+\.css)"[^>]*>/g,
                    (tag, fileName: string) => {
                        const file = ctx.bundle?.[fileName];
                        if (file?.type !== "asset") return tag;
                        delete ctx.bundle![fileName];
                        return `<style>${String(file.source)}</style>`;
                    },
                );
            },
        },
    };
}

// The splash: plain HTML with its styles inline, on screen before any CSS file or
// JavaScript arrives. React never touches it; the app fades it out once (shell/splash.ts).
const BOOT_CSS = readFileSync(new URL("../ui/styles/boot.css", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ");
// The logo is inlined (about 3 KB) so it paints with the page, not one request later.
const splash = (logo: string) =>
    `<div id="splash" class="boot"><img class="boot-logo" src="${logo}" alt="" width="70" height="70" />` +
    '<div class="boot-track"><div class="boot-bar"></div></div></div>';

// Fills index.html from the app's config: its name, its brand colour before any paint, and the splash.
function appHtml(app: AppConfig): Plugin {
    let logo = "";
    return {
        name: "tea-pos:app-html",
        configResolved(config) {
            const png = readFileSync(join(config.root, "public/icons/icon-192x192.png"));
            logo = `data:image/png;base64,${png.toString("base64")}`;
        },
        transformIndexHtml: (html) => ({
            html: html
                .replaceAll("%APP_NAME%", app.name)
                .replaceAll("%APP_SHORT_NAME%", app.shortName)
                .replace('<div id="root"></div>', `<div id="root"></div>${splash(logo)}`),
            tags: [
                {
                    tag: "script",
                    // /me starts with the page, not after the JavaScript: one round trip less (useMe takes it).
                    children: `if(location.pathname!=="/login")window.__me=fetch("/api/me").catch(function(){return null})`,
                    injectTo: "head-prepend",
                },
                {
                    tag: "meta",
                    attrs: { name: "theme-color", content: SHELL_COLOR },
                    injectTo: "head",
                },
                {
                    tag: "style",
                    // :root:root outranks the theme's default, wherever the stylesheet lands.
                    children: `:root:root{--accent-primary:${app.brand}}${BOOT_CSS}`,
                    injectTo: "head",
                },
            ],
        }),
    };
}

// The one Vite setup every app shares; an app only passes its config.
export function appConfig(app: AppConfig) {
    return defineConfig({
        define: {
            __APP_COMMIT__: JSON.stringify((process.env.APP_COMMIT ?? "dev").slice(0, 7)),
            __API_CONTRACT__: JSON.stringify(contract),
        },
        plugins: [
            // Routes from src/routes, each screen its own chunk.
            tanstackRouter({ target: "react", autoCodeSplitting: true }),
            react(),
            babel({ presets: [reactCompilerPreset()] }),
            tailwindcss(),
            preloadFirstScreen(),
            pickLanguage(app),
            inlineCss(),
            appHtml(app),
            VitePWA({
                // The update sheet asks first: reloading mid-order would drop the cart.
                registerType: "prompt",
                injectRegister: false,
                manifest: {
                    name: app.name,
                    short_name: app.shortName,
                    description: app.description,
                    id: "/",
                    start_url: "/",
                    display: "standalone",
                    orientation: "portrait",
                    background_color: "#ffffff",
                    theme_color: SHELL_COLOR,
                    icons: [
                        { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
                        { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
                        {
                            src: "/icons/icon-512x512.png",
                            sizes: "512x512",
                            type: "image/png",
                            purpose: "maskable",
                        },
                    ],
                },
                workbox: {
                    // The whole app is stored on the phone; heavy screens (charts, maps) are left out here when they arrive.
                    globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
                    navigateFallback: "/index.html",
                    navigateFallbackDenylist: [/^\/api\//],
                },
            }),
        ],
        // The bundle-size check reads which files the first screen loads.
        build: { manifest: true },
        // Local dev reaches the API the way the Pages forwarder does (API_ORIGIN=http://localhost:8080 for a local Go).
        server: {
            proxy: {
                "/api": {
                    target: process.env.API_ORIGIN ?? "https://api-staging-c60d.up.railway.app",
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/api/, ""),
                    headers: { "X-Edge-Secret": process.env.EDGE_SECRET ?? "", "X-App": app.id },
                    configure: (proxy) =>
                        proxy.on("proxyReq", (req, incoming) =>
                            req.setHeader("X-App-Origin", `http://${incoming.headers.host}`),
                        ),
                },
            },
        },
    });
}
