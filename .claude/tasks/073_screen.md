# Task 073 — The screen engine: the app's height and place, on every phone

**Status: Screen lab built 2026-11-16 on `feat/screen-check` (engine `frame/screen/measure.ts`, judge `judge.ts` with 6 unit tests, fake keyboards `fake.ts`: `?preview=keyboard` Android, `?preview=keyboard-ios` the iPhone's pan; More → Screen lab on staging, previews, dev). Seen locally: Android fake, chat's box passes (shrink); iPhone fake, the top field passes (cover) and chat's box fails (header moved 280 px), as on the owner's iPhone. Next: the owner runs it on the real phones. Send to PostHog left for later (needs a new event type in Go); Copy for now.**

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

## Two kinds of screen (the owner, 2026-11-17, after the first run on the iPhone)

- **App screens** (chat, search, forms in the app's frame): the header stays; the content and the bottom bar make room. The lab's keyboard cases at the top, middle, bottom and field to field judge this (`headerStill`)
- **Focus screens** (a code at the bottom of a screen, as the store's opening code): fitting the field and its button above the keyboard matters more than the header, which may slide away. The lab's new "a code at the bottom" case judges this: the header may move, the field must not be under the keyboard
- **Both:** a field being typed in is never under the keyboard (a new check, `fieldBottom`), and nothing is left shifted after
- A screen will say which it is on its route (`staticData.shell`), when the fixes come; app screen by default

Also fixed in the lab (the owner: back killed a running case, and a case opened scrolled down): each case is its own screen under the lab (`/screen-lab/<case>`), so it opens at the top like any new screen, back leaves it without a result and the list returns to where it was (the router's own scroll restore), and the results are kept outside the screens (and for the visit), so back and forth never loses them.

## First report, the owner's iPhone (2026-11-17)

iOS 18.7, installed, 390×844, the app 797 px tall.

- **Every interruption passed:** photo picker (cancelled and chosen), camera, our sheet, background, rotation: the app comes back filling the screen, nothing left shifted. The sign-in shift is not in the lab (sign-in is its own screen): to try with `?screen` there
- **The keyboard:** a field at the top passes (the keyboard only covers). Any field the keyboard would cover makes iOS slide the page (`pan`): the middle (36 px), field to field (61 px), the bottom (380 px, the keyboard's height), the focus case (335 px, allowed there). The keyboard is 335-380 px (with or without the suggestions row)
- **The lab's own mistakes, fixed:** (1) iOS reports one slide twice (as the page's scroll and the visible area's offset), so every slide read double (760 px for a 380 px keyboard): counted once now (`slidBeyondScroll`); (2) Finish judged before the keyboard had started closing, so the middle case "ended" with the keyboard still up: Finish now waits at least 0.8 s and until the screen is still; (3) a 2 px nudge iOS gives the header as a keyboard opens is not a moved header (3 px tolerance)
- **iOS 18.7 changes the plan (the owner: it must last on older iPhones too; no one should need iOS 27):** `interactive-widget` comes with Safari 27.3, which only an iPhone on iOS 27.3 or later gets. This iPhone (and any staff iPhone left on an older iOS) never will, so the iPhone's slide must be handled by us after all: RFC step 6 (chat) and the forms' middle fields, not only "wait for Safari"
- **The report now carries each run's frames** (`timeline`: t, page, visible, offset, scrollY, headerTop, fieldBottom; at most 80 a case): how the iPhone's slide unfolds frame by frame is what the chat fix (step 6) is designed from

## Second report and the iPhone fix (2026-11-17)

**Status: in progress (the owner: build it; Android to be tried later on a borrowed phone).**

The timelines show how iOS 18.7 (installed) makes room: in the first frame after the tap the visible height drops by the keyboard (797 to 417) **and the document scrolls** (`scrollY`) just far enough to show the field (bottom box 380, middle 111, field to field 61, the code 335); the visible area's offset stays 0. Then the keyboard slides in over about 250 ms. #146 corrected the offset, which never moves here, after the scroll was drawn: the jump then flash.

**The fix (`frame/screen/keyboard.ts`), for any phone whose page does not shrink with the keyboard:**
- In the same event that reports it (visualViewport resize or scroll, the page's scroll, before the frame is drawn): the app's frame takes the visible height (`data-keyboard-fit`, `--keyboard-fit`) and the document's scroll goes back to 0. The bottom box is then already above the keyboard and the header never moves
- The frame's height follows the keyboard over 250 ms (none with reduced motion), opening and closing
- A field inside the content the smaller frame would hide is scrolled into view inside `#shell-scroll`, never by moving the page
- Where the page shrinks by itself (Android with `resizes-content`, Safari 27.3, an old Chrome that resizes) nothing of this runs: only the tab bar steps aside, as today. An Android browser that only covers (no shrink) gets the same fix as the iPhone
- Zoomed in: nothing
- The fake iPhone keyboard slides the page at focus as iOS does, so the fix is tried locally the same way

**The judge:** a field counts as under the keyboard only when it stays there 300 ms or more (the keyboard's own slide). The code case failed on one 16 ms frame before iOS moved it.

**Done when:** on the owner's iPhone the lab's keyboard cases show the header moved 0 (within 3 px) and no field under the keyboard; locally the fake iPhone and fake Android pass.
