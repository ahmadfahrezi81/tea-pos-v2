# Task 017c — Files: photo uploads that work on slow 4G

**Status: planned 2026-10-24, waiting on the owner's review.**

## The goal

Every photo in both apps (close-day photos, expenses, reports, product images, avatars, payroll proofs) goes the same way: shrunk on the phone, uploaded straight to Supabase Storage with a signed address from Go, retried when the signal drops. One component, one route, one rule for who may see what.
RFC: At a glance (photo uploads, signed URLs), Supabase stays for files. Build order Step 17c (moved from Step 18: both apps upload).

## Where it stands today

- The old app's buckets: `daily-photos` (private, close day), `payroll-proofs`, `product-images`, `avatars`; it signs URLs through supabase-js on the server
- v2's Go has only Supabase's publishable key (sign-in); signing uploads needs the secret key

## The plan

1. **Go signs, the phone uploads:** `POST /api/files/upload` (signed in, per tenant) takes what the file is for (`purpose`: `daily_photo`, `expense`, `report`, `product_image`, `avatar`, `payroll_proof`) and its size; Go checks the caller may upload that kind, picks the bucket and a path (`<tenant>/<purpose>/<date>/<uuid>.webp`, never the phone's file name), and returns a signed upload URL valid for a few minutes. The phone PUTs the file straight to Supabase: the photo never passes through Railway
2. **Reading:** private buckets only; `GET` routes that return a photo return a short-lived signed read URL, made by Go for callers allowed to see it (one helper, `internal/files`). The bucket rules stay in Go, not in Supabase policies
3. **Shrunk on the phone first** (`packages/ui` `PhotoInput`, its code loaded only when a photo is taken): longest side 1600 px, WebP at quality 0.8 (JPEG where WebP encoding is missing), done off the main thread (`createImageBitmap` and `OffscreenCanvas` in a worker where supported). A 4 MB camera photo becomes about 200-300 KB: about 10× less to send on slow 4G. Orientation fixed from the photo's own data
4. **Retried:** an upload that fails (no signal, timeout) is tried again with backoff while the app is open, with its progress shown; the screen's save waits for it. The file is kept in memory, not on the phone (offline queues come after every store runs v2)
5. **Secret key:** `SUPABASE_SECRET_KEY` for `api` (Infisical, `preserve()`); config refuses to start the API without it, like the other secrets
6. **Tests:** integration tests against a fake Storage: a seller cannot get an upload URL for another tenant, nor for a purpose their role may not upload; paths never contain the phone's file name; a read URL is only signed for an allowed caller. A browser check that a 4000×3000 photo leaves the phone under 400 KB, measured on the 20× throttled profile for the time it takes

## Owner's part

- **Supabase:** the project's secret key (Project settings → API keys → Secret key; for staging and production) into Infisical `staging` and `prod`, path `/app`, as `SUPABASE_SECRET_KEY`. I'll write the clicks

## Open questions

1. **WebP or JPEG:** WebP is about 30% smaller at the same quality and every phone we support shows it; JPEG only as the fallback. I recommend WebP
2. **The size and quality (1600 px, 0.8):** enough to read a receipt and see a store's display, at about a quarter of today's upload. Your call if photos must stay sharper

## Done when

- One photo through the whole path on staging: shrunk on the phone, uploaded straight to Storage, shown back through a signed read URL
- A photo taken on a 20× throttled profile is shrunk without freezing the screen, and leaves at under 400 KB
- An upload interrupted halfway (network cut in DevTools) finishes by itself when the network returns
- A seller of another tenant gets 403 for an upload URL and for a read URL

## Not in this task

- The screens that take photos: with their features (Step 18 stores and products, Step 31 close day, Step 32 reports)
- Offline uploads (kept on the phone until the network returns): after every store runs v2
