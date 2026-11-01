# Task 053 — Seller v2: the owner's feedback

**Status: open, collecting. The owner tests locally on `feat/seller-v2`; every point is written here as they say it, then fixed in rounds.**

## Round 1

1. **Changing language loops, calling `/me` again and again.** Fixing now. A reload restored the old `/me` from the saved cache, which set the old language and reloaded; the fresh `/me` then set the new one and reloaded, for ever. The language now follows only a `/me` fetched since the page opened
2. **A failed load looks like an empty day.** Orders said "No orders found" on a 403, with its figures loading for ever. Fixed: `LoadFailed` on every new seller screen

## Found reading the branch top to bottom

3. **An earlier day held by someone else could not be closed,** and nothing could open until it was. Today only: the holder rule no longer applies to an earlier day
4. **An order from a phone left on the menu after a take-over was accepted** and earned nobody a commission. Refused now
5. **A store with no opening hours drew At a Glance from midnight** instead of the defaults
6. **My Pay, My Claims and the Orders totals stayed stale after closing a day.** They refetch with it now
