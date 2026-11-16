# Task 073 — The screen engine: the app's height and place, on every phone

**Status: approved 2026-11-16 (the owner: check the design, then build); step 1 (the screen check) built and seen locally on `feat/screen-check`; no behaviour change.**

## The goal

The app always fills exactly the visible screen and sits still, on every phone, whatever covered it a moment ago. [RFC: The keyboard (v2)](https://app.notion.com/p/41a95a71540581fe9edfec6aaea46993), "The screen's height, after every interruption", steps 4-6. Found by the owner on the iPhone: back from a cancelled Google sign-in the screen is shifted; choosing a photo in chat it froze half moved; a chat's box slides the whole page.

## Why we do not have it already

- **v1 had one piece:** `useStandaloneViewportHeight` (installed apps: CSS heights go stale after the phone sleeps, so the shell measures the real one on resume). v2 copied it as it was (`packages/shell/frame/useStandaloneViewportHeight.ts`). It was written for an Android case and handles the height only.
- **Nothing ever handled the iPhone's interruptions:** the sellers are on Android, where the page resizes and comes back cleanly; the owner is the only iPhone user, and chat (a field at the bottom, photos from the picker) is the first screen that leans on it.
- **So it is not "dropped in v2":** it was never built. The pieces exist (that hook, `keyboard.ts`), scattered; this gathers them.

## The design, checked

**What we know shifts a page on the iPhone** (installed, before Safari 27.3): the keyboard pans the page to show a low field; the photo picker, the camera and a sign-in sheet cover the app and resize or scroll it, and iOS does not always put it back; the page can be left scrolled although only `#shell-scroll` is meant to scroll (`html` and `body` do not forbid it today: `body` is `min-height: 100svh`).

**Three ways to fix it, weighed:**

| | | Verdict |
| --- | --- | --- |
| Correct it while it moves (follow and undo iOS's movement) | #146, #147 | Rejected: races iOS, shakes, moves things under the finger |
| Structure: the page itself cannot scroll, only the content inside does | CSS | Yes, as a guard: removes "left scrolled" for good, costs nothing; cannot fix a wrong height |
| Measure and put back, only after an interruption ends (nothing is being looked at mid-move: the keyboard closed, back from the picker, sign-in, the background) | JS, the existing hook's way | Yes: the hook already does it for resume; extended to the other ends |

**And first, measure:** we do not know which of these each shift is (a wrong height, a page left scrolled, the visible area left offset). Guessing is how #147 failed. So step 1 changes nothing and shows the numbers on the phone.

## The plan

1. **The screen check** (`?screen` in the address, any build; kept for the visit): a small panel in a corner, drawn without React from the app's start (`packages/shell/lib/screen-check.ts`, loaded only when asked), so it works on sign-in too. Live: the page's height (`innerHeight`, `clientHeight`), the visible area (`visualViewport` height, offset, scale), the page's scroll, the frame's height and top, `--shell-height`, `data-keyboard`, installed or not, the focused field; and the last 12 events (resize, visible-area resize and scroll, focus in and out, hidden and shown, page shown) with those numbers at each; Copy and Hide buttons. No behaviour change
2. **The owner reproduces** on the iPhone with `?screen`: sign-in cancelled, a photo chosen in chat, a chat's box, coming back from the background; screenshot or Copy at the shifted moment
3. **The fixes, from those numbers, one at a time:** the guard (the page cannot scroll), and `screen.ts` (the hook and `keyboard.ts` gathered) measuring again and putting the page back when each interruption ends. Each checked on the iPhone, Android unchanged
4. **Chat on the iPhone** (RFC step 6), on top of it, draft first

## Owner's part

Step 2 on the iPhone (and an Android if at hand).

## Done when

- The screen check shows the numbers on the iPhone and on sign-in
- After each interruption the app fills the screen and sits still, on the iPhone and Android
- `pnpm lint`, `pnpm typecheck` pass

## Not in this task

Chat's own keyboard ride beyond step 4; anything for Safari 27.3 (it needs nothing).
