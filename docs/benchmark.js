// The benchmark in one table. Save as a DevTools Snippet (Sources → Snippets, name it
// "bench"), record a reload at 20× CPU and Slow 4G with Disable cache, then run it with
// Cmd+P → "!bench". Incognito or a Chrome profile with no extensions. RFC: Performance.
(async () => {
    const ms = (n) => (n == null ? "–" : Math.round(n) + " ms");
    const get = (type) =>
        new Promise((done) => {
            const list = [];
            const po = new PerformanceObserver((l) => list.push(...l.getEntries()));
            po.observe({ type, buffered: true });
            setTimeout(() => (po.disconnect(), done(list)), 50);
        });
    const [lcp, tasks] = await Promise.all([get("largest-contentful-paint"), get("longtask")]);
    const nav = performance.getEntriesByType("navigation")[0];
    const res = performance.getEntriesByType("resource");
    const me = res.find((r) => r.name.includes("/api/me"));
    const main = res.find((r) => /\/assets\/index-.*\.js$/.test(r.name));
    console.table({
        "splash (FCP)": ms(performance.getEntriesByName("first-contentful-paint")[0]?.startTime),
        LCP: ms(lcp.at(-1)?.startTime),
        // Set by hideSplash() in packages/shell/splash.ts.
        "app ready": ms(performance.getEntriesByName("tea-pos:ready")[0]?.startTime),
        "/me starts": ms(me?.startTime),
        "/me answered": ms(me?.responseEnd),
        "main JS loaded": ms(main?.responseEnd),
        // Stands in for our main-thread time; compare PR against PR, not against the Summary tab.
        "long tasks (total)": ms(tasks.reduce((s, t) => s + t.duration, 0)),
        "from service worker": nav.workerStart > 0 ? "yes (reopen)" : "no (first visit)",
    });
})();
