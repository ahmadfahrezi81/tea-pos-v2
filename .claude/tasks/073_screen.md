# Task 073 — The screen engine: the app's height and place, on every phone

**Status: step 1 (the screen check panel) built on `feat/screen-check`, not pushed. Redesigned 2026-11-16 at the owner's ask: not only a panel but a tool that runs the tests (the Screen lab, below) on an accurate measuring engine; waiting on the owner's review.**

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

## The Screen lab (the owner, 2026-11-16: an actual tool, not only debugging)

**What it is:** a screen in both apps (More → Screen lab; staging and the dev server only, a flag in production) that runs each case for real on the phone it is opened on and says, for each, **passed or failed and why**, with the numbers to send. The panel of step 1 stays, as its live view.

**What a web page can and cannot do:** it cannot open the keyboard, the photo picker or the camera by itself: a phone only opens them from a person's tap. So each case is one big button the owner taps; everything after the tap (measuring, judging, recording) is the lab's.

**The cases** (each the real thing, not a stand-in):
1. The keyboard from a field at the top (as search), in the middle, at the bottom (as chat's box), and in the shell's footer slot
2. The keyboard closing: by Done, by tapping outside, by scrolling
3. Moving from one field to another with the keyboard open
4. The photo picker opened and cancelled; a photo chosen
5. The camera opened and cancelled
6. A bottom sheet opened and closed (ours)
7. The app sent to the background and back (the lab says when to switch away)
8. A rotation and back
9. Sign-in cancelled and back (on the sign-in screen: the lab's check runs there through `?screen`)

**What each case checks, the same rules for every phone:**
- after it ends, the frame fills the visible screen exactly (within 1 px), its top at 0
- the page itself is not left scrolled (`scrollY` 0, the visible area's offset 0)
- the header never moved while it ran (where the header should stay)
- how long the phone took to settle, and whether it settled at all
- for the keyboard: the height the phone reported, when it started and ended, whether the page shrank (Android, Safari 27.3) or panned (the iPhone today)

**The measuring engine** (`packages/shell/frame/screen.ts`, later used by the app itself, not only the lab):
- **Samples every frame** (`requestAnimationFrame`) from the tap until nothing has changed for 300 ms, or 3 s: the whole movement, not one reading, so the start, the end and every step in between are known
- **Reads every source the phone has, each for what it means:** the page's height (`innerHeight`, `clientHeight`), the visible area (`visualViewport` height, offset, scale), the page's scroll, the frame's real box on screen, `--shell-height`; Android's `virtualKeyboard` where it exists
- **Never trusts a single event:** events only start a sampling run; the numbers come from the frames that follow, so a late, missing or doubled event cannot fool it
- **Ignores what is not a layout change:** pinch zoom (scale above 1.01), a rotation in progress (width changing)
- **Tested off the phone too:** the judging rules are plain functions over recorded samples, with unit tests from recorded runs (an iPhone's pan, Android's shrink, a picker that never gave the height back)

**What comes out:** a report per phone: the phone and browser, installed or not, each case passed or failed with its numbers; Copy, and Send (to PostHog through `/api/events`, so each phone's run is kept and compared).

**The fixes come after**, case by case, from the failures, and each fix is proven by the same case turning green on the iPhone and Android. Chat on the iPhone is case 1 (bottom) turning green.

### Build order (replaces "The plan" above)

1. The measuring engine and its unit tests (recorded runs)
2. The Screen lab with the cases and the report; locally first (the fake keyboard for the keyboard cases), then staging for the owner's iPhone and an Android
3. The owner runs it on both phones and sends the reports
4. The fixes, one failure at a time, each turning its case green
