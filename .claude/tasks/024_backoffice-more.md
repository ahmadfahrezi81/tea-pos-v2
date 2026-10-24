# Task 024 — The backoffice's More: weather, location feedback, patch notes

**Status: built 2026-10-25 overnight, merged to staging when green (decisions in `overnight-log.md`). Checked: integration test (feedback newest first with who wrote it, another tenant's left out, admins only; the weather by hour, rounded, for a seller too); typecheck, lint, bundle.**

## The goal

v1 backoffice's More tab, one-to-one in look: General with Weather (a sheet), Location Feedback (a map and the list) and Patch Notes; Supply and Chats stay "coming soon", as in v1.
RFC: Build order Step 24.

## The plan

1. **`GET /tenants/{tenant}/feedbacks`** (admins): where customers asked for a store, newest first, with who wrote it down
2. **`GET /tenants/{tenant}/weather`** (anyone signed in): the forecast by hour, yesterday to tomorrow, from v1's `weather_hourly` (the cron website fills it until Step 45, when the worker's per-area weather takes over)
3. **Screens:** More (General: Weather, Location Feedback, What's new; then Account), the weather sheet (v1's, Bebas Neue title, an hour back to six ahead), `more/map` (Leaflet with OpenStreetMap tiles, a count per place, the list by day with search and a filter sheet)
4. **Patch notes:** v1's Patch Notes is What's new (Step 17d), written by the release skill

## Not in this task

- Supply and Chats: later steps (v1 shows them as coming soon too)
- The seller's own weather and map screens (adding a store, Step 35)
