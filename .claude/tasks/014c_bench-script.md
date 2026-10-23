# Task 014c — `pnpm bench`: the same benchmark every time

**Status: built 2026-10-23 (approved the same day), in PR #27 with the snippet. Checked on a local production build of backoffice against local Go with the fixture admin's session: signed out it stops with the `--sign-in` hint; two runs of 5 agree (reopen ready 0.44 s both times, first visit 3.48 s both times); 20× measured as 20.1× with a busy loop. Its numbers come out lower than by hand, most likely because recording a DevTools trace itself slows a 20× page, so its rows start a new series in the Benchmark log rather than continue the old one. Waits on the owner's `--sign-in` on staging for the first real row.**

## The goal

One command runs the benchmark exactly the same way every time, as a signed-in user opening home, and prints the numbers plus a row for the RFC's Benchmark log. Today it is several manual DevTools settings and a snippet, so runs differ.
RFC: Performance (the benchmark phone, how to benchmark, Benchmark log).

## How it works

**Sign in once:** `pnpm bench --sign-in` opens a normal Chrome window on its own profile folder (`~/.tea-pos-bench`, outside the repo, never committed). You sign in with Google there yourself; Go sets the `session` cookie and Chrome keeps it in that folder, as a phone does (30 days, renewed while used). The script never sees the password or the token.

**Every run:** `pnpm bench <url>` starts Chrome on the same folder, so the app opens straight to home, like a seller the day after signing in. Then, through the Chrome DevTools Protocol (what DevTools itself uses):

1. **20× CPU and Slow 4G**, set by the script, the RFC's benchmark phone. Disable cache on, as by hand
2. **5 reopens:** a normal reload; the service worker serves the app and the saved cache draws home
3. **5 first visits:** the app's saved files, service worker and saved data are cleared first, **the cookie kept**, then a load: a signed-in user on a fresh install or after an update
4. After each load it reads what `docs/benchmark.js` reads: splash (FCP), LCP, app ready (`tea-pos:ready`), `/me` start and answer, main script arrival, long tasks
5. **Medians** of each five (one run varies 10-20%), printed as a table, then **one line for the Benchmark log**, with date and WIB time, the URL and the commit `/health` reports

**What a phone adds:** a last line, **"on a Galaxy M11 ≈ Chrome start + app ready"**. Chrome start is one setting in the script, **4.0 s** for now (the M11's 5.5 s open minus our ~1.5 s). It is added to the report, not waited in the run: a fixed wait would make every run slower without showing whether a PR helped. When the M11 is measured properly (tap to splash, splash to ready), only that number changes.

**Safety:** if the session has expired and the app lands on `/login`, the script stops and says to run `--sign-in`, rather than benchmark the sign-in screen. `pnpm bench --sign-out` signs out and deletes the folder. Whoever has the folder is signed in as you on that address, so it stays on the laptop.

## The plan

1. **`scripts/bench.mjs`**, run by `pnpm bench` from the root `package.json`
2. **`puppeteer-core`** as a root dev dependency: it drives the Chrome already installed (no 150 MB browser download) and ships nothing to users. The one new dependency; it replaces the manual DevTools steps
3. `--runs N` (default 5), `--reopen-only`, `--first-only`, `--chrome-start 4.0`
4. `docs/benchmark.js` stays, for a quick read in DevTools by hand
5. **RFC:** "How to benchmark" points at `pnpm bench` first, DevTools by hand second; new rows of the Benchmark log come from its output

## Owner's part

Run `pnpm bench --sign-in` once and sign in with Google on staging (seller and backoffice each, since each app has its own address and cookie).

## Done when

- `pnpm bench https://tea-office-staging.lykostech.app` prints medians for reopen and first visit, the M11 line and a log row, without touching the login page
- Two runs in a row agree within about 10% on app ready
- An expired session stops the run with the `--sign-in` hint
- The folder is outside the repo, and `--sign-out` removes it

## Not in this task

Driving Chrome on the M11 itself over USB (`adb`), which would measure the real phone the same way and replace the 4.0 s estimate: a follow-up once this works. Running it in CI (shared runners are too noisy, and it would need a session stored as a secret).

## Follow-up, 2026-10-24: a stalled load is tried once more

On release PR #34 the benchmark failed once on GitHub's runner: one reload never became ready within 2 minutes (the re-run passed; the same code ran fine locally). Now a load that is not ready within 60 s is logged with what the page showed (path, load state, splash, service worker) and tried once more; two stalls in a row fail the run with "two loads in a row never became ready". Checked by pointing it at a page that is never ready (both attempts logged, then the error) and at staging's backoffice (unchanged numbers). Also: the warm-up now waits until the app is ready and 2 s more, so the saved copy exists before the first reopen; a single-run check had shown one 3.14 s reopen against 0.5-0.8 s otherwise.

