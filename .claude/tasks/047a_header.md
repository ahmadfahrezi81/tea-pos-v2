# Task 047a — The header: three slots and reusable actions

**Status: built 2026-10-28, not committed; waiting on the owner's review (built ahead of review, at the owner's ask).**

## The goal

One bar on every screen, in both apps: left the avatar (a tab's home) or back; centre the title on one line, ellipsis when long; right the screen's actions.
RFC: [Backoffice v2 refinement](https://app.notion.com/p/40595a7154058188873dd594ee4b7875), The header; Step 47a.

## The plan

1. **`packages/shell/MobileHeader.tsx`:** a three-column grid with equal sides, so the title stays centred; the title never drops below the back button
2. **`packages/shell/HeaderActions.tsx`:** `<HeaderActions actions={[{ kind: "add", to: "add" }]} />` in a screen, portalled into the header's right slot (as `FooterSlot`). Kinds: add (plus in a circle), edit (pencil), settings (gear); share comes with chat. `to` without a slash is under the screen. At most two show; with more, the first shows and the rest go into a ⋯ menu
3. **Route data keeps only the title and parent:** `inlineHeader`, `headerAction` and `titleAccessory` leave `ShellRoute`; Claim Types and Commission Types use `<HeaderActions>`

## Done when

- Typecheck, lint, build and bundle size pass
- The owner checks on staging: titles centred on one line; add on Claim Types and Commission Types

## Not in this task

- Share (with chat), a title from data (a person's name on the payslip): when a screen needs it
