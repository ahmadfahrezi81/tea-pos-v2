# Task 053 — Seller v2: the owner's feedback

**Status: open, collecting. The owner tests locally on `feat/seller-v2`; every point is written here as they say it, then fixed in rounds.**

## Round 1

1. **Changing language loops, calling `/me` again and again.** Fixing now. A reload restored the old `/me` from the saved cache, which set the old language and reloaded; the fresh `/me` then set the new one and reloaded, for ever. The language now follows only a `/me` fetched since the page opened
2. **A failed load looks like an empty day.** Orders said "No orders found" on a 403, with its figures loading for ever. Show an error instead, on every new seller list
