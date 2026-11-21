---
name: patch-notes
description: Write a release's What's new lines in English and Indonesian into packages/shell/whats-new.json. Use before every release PR (the release skill runs it first), or when asked to "add patch notes" or "write What's new". Decides what in staging's changes a user could notice, then writes one short line per change.
---

# Patch notes

What's new lives in `packages/shell/whats-new.json`, newest first, one entry per release that has anything a user could notice. Both apps read it (each shows only its own entries), and chat links to it: when a release deploys, the worker posts "What's new in <version>" in General, opening this screen at that version (task 074).

```json
{ "version": "2026.11.3", "date": "2026-11-21", "apps": ["backoffice"], "lines": { "en": ["…"], "id": ["…"] } }
```

## 1. When

Before the release PR, in a small PR into `staging` (`docs(whats-new): 2026.11.3`), so the release carries its own notes. A release that deploys without its entry never gets its chat post (the worker posts only the newest entry, once).

- **The version** is the release PR's title: `YYYY.MM.N`, the Nth release this month (`gh release list` shows the last one).
- **What is going out:** `git log --oneline --first-parent origin/main..origin/staging`.
- After editing the file, run `pnpm --filter @tea-pos/api generate`: Go embeds a copy (`api/internal/chatevent/whats-new.json`) and CI fails on a stale one.

## 2. Decide what a user could notice

Most of a diff is invisible. Read each change, never only its commit title.

- **Include:** new screens or controls, changed behaviour people will hit, bugs they could have reported, speed they can feel, wording on screens they read.
- **Exclude:** refactors, renames, CI, migrations with no visible effect, dependency bumps, logging, tests, docs.
- **Apps:** `seller`, `backoffice`, or both. A change in `packages/` counts for each app that shows it; chat counts only where people have it (today the backoffice).
- If nothing is user-visible, write no entry. That version has no card and no chat post, which is correct.

## 3. Write the lines

Almost nobody reads release notes. The few who do look for one thing (was my problem fixed) in about four seconds.

- **One line each.** No reason, no second clause.
- **Five lines at most.**
- **Start with what the reader cares about:** "You can now…", "The orders list…".
- **Ordinary words**, for people reading English as a second language. No file, table, library or flag names; no version numbers.
- **Added, improved or fixed:** say which by the wording ("You can now…", "… is faster", "… no longer …"). Never "changed".
- **Indonesian:** the same lines, as people say them, not word for word. Keep the words the staff use in English: restart, cups, week, opening, closing, refresh.

Good: "You can now share a pay period into a chat." / "Kamu sekarang bisa membagikan periode gaji ke chat."

Bad: "Added ChatLink resolution to ListChatMessages." (internals, nothing the reader can act on)

## 4. Published notes

A note that shipped is history. Fix one only if it is wrong; something forgotten goes in the next release or nowhere.
