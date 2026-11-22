# Task 064 — Picker card polish

**Status: done 2026-11-15, PR #142; release 2026.11.14.**

## The goal

Small fixes to the store and date card (task 063, B) seen on a phone. Logged as they come.

## The log

- **A. The heading back to full size:** 19 px was too small to read on a phone; the store and the date are 22 px again, as the date was before 063. The POS card's store name too (`PickerRow` `brand`). `packages/ui/controls/PickerButton.tsx`
- **B. "This month Pagelaran":** the date in dark, the store in blue, side by side, no word or dot between (tried "·", then "at" in grey, bold, light, medium); a long store name shortens first. `PickerRow`
- **C. The space under the header, the owner's numbers:** header top 12, avatar to the loader bar 8, the bar 3, the bar to the header's edge 6, the page's top 6 (was 12, 8, 3, 8, 8; 4 and 4 tried, too tight): avatar to the first card 23 px, was 27. Every screen in both apps. `MobileHeader.tsx` `pb-[17px]`, `nav-progress.css` `bottom: 6px`, `MobileShell.tsx` `pt-1.5`
- **D. The store lists show open stores only, both apps:** demo stores are picked only in the seller's More → My Stores, closed ones nowhere; the store chosen shows whatever it is, with its Demo or Inactive badge (the Store menu had lost them). Backoffice's eye switch is gone (nothing left to hide), so a demo store has no way in there (owner: fine). `tenant.tsx`, `StoreSheet.tsx`, `StoreLabel.tsx` `storeOption`, `DateRangeSheet` option `badge`
- **E. Look past the POS gate from More, not the gate:** the owner's switch (the big `Switch`) in a new Owner group on seller More; on, POS and Manage open past the gate with the amber "nothing is saved" banner (no ×, turned off in More). Off again on reload: nothing saved anywhere. The gate's "Look anyway (owner)" link removed. A settings row with only a switch is no longer a button itself. `lookOnly.tsx`, `StoreGate.tsx`, `more/More.tsx`, `shell/frame/Settings.tsx`
- **F. Analytics' second line says how far into the month:** "1 – 15 Nov · Day 15 of 30", a past month "1 – 31 Oct · 31 days" (id: "Hari ke-15 dari 30", "31 hari"); no extra request. Seller `home/period.tsx` `MonthBar`
- **G. The picker card bigger:** the heading 22 px (production had 19; 24 tried, too big); the card thicker (padding 14 top and bottom, 16 the sides; was 10 and 12); the chevron after the text stays a down chevron (up-down tried). Tried and dropped: a light shadow; no icon box (the POS card looked empty), so the box stays, now 48 px (was 40), as tall as the two lines beside it, its icon 30 px (26 tried); the icons themselves to be redone. `PickerButton.tsx`, `StoreLabel.tsx`
- **H. A store-and-date icon:** Lucide's Store and CalendarDays the same size (68%), overlapping corner to corner, the calendar in front cutting into the store (a small badge tried first: too cramped); drawn at 40 px in the 48 px box, lines as thin as Lucide's at 30 px, the store cut by a mask (painting a tinted shape over it left a haze) (`StoreCalendarIcon`), on Orders, Analytics and the backoffice Store screens when the sheet can change the store; the calendar alone when it cannot; the POS card keeps the store. Chosen from four drawn options (split, split with a line, two small, badge). The chevron stays a single down one. `packages/ui/controls/StoreCalendarIcon.tsx`, `PickerButton` `withStore`

## Done when

- The owner has checked both apps on a phone; format, lint and typecheck pass
