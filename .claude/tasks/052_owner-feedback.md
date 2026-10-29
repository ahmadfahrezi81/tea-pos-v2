# Task 052 — The owner's feedback round

**Status: in progress 2026-10-29, on `feat/backoffice-feedback`; changes added as the owner gives them.**

## The goal

The owner's test round on staging (RFC: [Backoffice v2 refinement](https://app.notion.com/p/40595a7154058188873dd594ee4b7875), Step 52): mostly UI fixes, each made as it is given, all in one PR.

## The changes

1. **The header, back to v1's on a tab's home:** the big title on the left, the avatar (Account) on the right, the screen's actions between them. A screen under a tab keeps 047a's bar: back on the left, the title centred on one line, the actions on the right. `packages/shell/MobileHeader.tsx`, so both apps get it

## Done when

- Typecheck, lint, build and bundle size pass
- The owner checks each change on staging
