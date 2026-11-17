# Task 072 — The keyboard: one way for every field

**Status: done on staging 2026-11-16, PR #148 (the browser's own behaviour, the tab bar steps aside); the iPhone's slide moved to task 073. Android to be tried on a borrowed phone.**

## The goal

Typing feels native on both phones, the same for every field: the chat's message box, search boxes, a store's opening code (`StoreGate`), forms (`TextInput`, `NumberInput`, `Textarea`, `PersonalDetailsScreen`, `StoreSettings`, UAC). Today the iPhone pans the whole app up (header too), and Android lifts the tab bar above the keyboard. Found while testing chat on staging (068b item 24; PR #146's fix corrected the pan after it happened, which flashes: superseded by this task). Taken slowly: tried on the owner's phones over Wi-Fi before any PR.

## How the native apps do it

**iOS (UIKit):** the keyboard slides up over about 0.25 s on the system's curve. The app is told its height and timing before it moves (`keyboardWillShow`) and moves only what must stay visible, in step with it: a chat's input bar rides on top of the keyboard, the list above gets that much bottom space, the newest message stays in view. The navigation bar never moves. The tab bar does not move either: the keyboard simply covers it. Dragging the messages down pulls the keyboard down with the finger (interactive dismiss).

**Android:** an app picks `adjustResize` (the window shrinks, the layout reflows) or `adjustPan` (the window slides up to show the field: what our iPhone does now). Modern apps resize and, since Android 11, animate in step with the keyboard (`WindowInsetsAnimation`). The bottom navigation is hidden while typing (Material), so it never floats on the keyboard.

**Both agree:** the top stays; only the screen's own bottom bar (an input bar, a Send or Save button) rides on the keyboard; the tab bar never sits on it; the content behind gets room to scroll; no jump, no second movement.

## What a web app can do

| | Android (Chrome) | iPhone (Safari, installed or not) |
| --- | --- | --- |
| Keyboard's height | `navigator.virtualKeyboard` (`overlaysContent`, `env(keyboard-inset-height)`), or the page resizing (`resizes-content`, today) | `visualViewport` only, reported as or after it opens |
| Its timing | not given | not given |
| The page | does what we tell it | pans the page to show the field, unless the field is already above the keyboard when focused |

So iOS is the hard one: it pans only when the focused field would end up under the keyboard. If the bar is already lifted by the keyboard's height when the field gets focus, nothing pans.

## The plan

1. **One keyboard engine in the shell** (`packages/shell/frame/keyboard.ts`): the keyboard's height as one number, from `virtualKeyboard` on Android and `visualViewport` on the iPhone; on the root as `--keyboard` (px) and `data-keyboard="open"`. Replaces `useKeyboardViewport.ts` (#146) and the `resizes-content` setting (`overlays-content` instead: we place things ourselves on both)
2. **The layout rule, the same on both phones:**
   - the header never moves
   - the tab bar stays where it is and the keyboard covers it (iOS's way; on Android it would otherwise float on the keyboard)
   - the screen's own bottom bar (`FooterSlot`: chat's box, `FormFooter`'s Save) rides on the keyboard: `translateY(calc(-1 * var(--keyboard)))`
   - the scroll area gets `--keyboard` of bottom room, so every field and the last message can scroll into view; chat keeps the newest message in sight
3. **No pan on the iPhone:** the engine remembers the keyboard's height on this phone (saved after the first time; a first guess from the screen size) and lifts the bottom bar to it the moment a field is touched, before it is focused, so iOS sees the field already above the keyboard. A field not in a bottom bar (search at the top, a form's fields) is focused with `preventScroll` and scrolled into the room above the keyboard by us, smoothly
4. **One movement, on the keyboard's own curve:** our lift uses one shared transition (`--ease-keyboard`, about 250 ms, in `motion.css`), so the bar and the keyboard arrive together; nothing moves twice
5. **Every field gets it for free:** the engine listens for focus on the whole app; `TextInput`, `NumberInput`, `Textarea`, `SearchBox`, the opening code and chat's box need no code of their own
6. **Tried before the merge:** on a draft PR's Pages previews (real https, sign-in works; the dev server over Wi-Fi cannot sign in), each push tuned on the owner's phones; then it leaves draft

## Owner's part

Try each step on the iPhone (and an Android if one is at hand) over Wi-Fi, from a link I send.

## Open questions

- ~~The tab bar while typing~~: covered (decided 2026-11-16: the same look as hidden, nothing to time)
- Suggestion: drag the messages down to close the keyboard, as iOS chats do (later, if wanted)

## Done when

- On both phones, tapping chat's box, a search box, the opening code and a form field: the header stays still, nothing jumps or flashes, the field ends up just above the keyboard, the tab bar never floats on it
- Closing the keyboard puts everything back in one movement
- `pnpm lint`, `pnpm typecheck` pass; the owner says it feels right on both

## Not in this task

Interactive dismiss by dragging (a suggestion above); the chat's own layout beyond its box riding the keyboard.

## What went wrong (PR #147)

- **It moved the page under the finger.** It lifted the bar and scrolled the content on the touch itself, before the keyboard existed: the tap then landed on whatever slid under it (a store's chat opened instead of the field).
- **It guessed.** The keyboard's height was a guess (or last time's), not what the phone said; anything wrong in the guess moved the screen twice.
- **It was built all at once and never seen on a phone** before the owner tried it: no measurement of what the iPhone actually reports, and when.

## Second attempt

**Rules:**
1. Nothing moves until the phone says the keyboard is there; never a guess.
2. Nothing moves while a finger is down.
3. What moves follows the keyboard's real position as the phone reports it, one step at a time; no animation of our own racing it.
4. Small: one behaviour per step, each tried on the phones before the next.

**Steps:**
0. **Revert** #146 and #147: back to how it was before (the owner: the first was better)
1. **Measure first, change nothing:** a small test screen (More → a hidden "Keyboard test", staging only) with a field at the top, the middle and the bottom, and a live log of what the phone reports while the keyboard opens and closes (`visualViewport` height and offset, the page's scroll, Android's `virtualKeyboard`), every frame, with times; a Copy button. The owner opens it on the iPhone and an Android, taps each field, sends the log. The design comes from that data, not from guesses
2. **The easiest win:** on Android the page already shrinks for the keyboard; only the tab bar floating on it is wrong: hide the tab bar while the keyboard is open (from the measured state). Tried, then next
3. **The iPhone,** from what step 1 showed: either follow the keyboard's reported position frame by frame, or, if iOS reports too late to follow, keep its own pan and only stop what it breaks. Decided with the owner from the data
4. **Every field** gets the result (search, opening code, forms, chat), checked one by one
