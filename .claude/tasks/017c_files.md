# Task 017c — Files: photo uploads that work on slow 4G

**Status: built 2026-10-24, not committed. Checked locally: integration tests against a fake Storage (a store's photo under its tenant and store, named by Go; every address in the old app's row form; another tenant's store, a seller's product image, over 1 MB and not a photo are refused). Changed after a check of staging's buckets: only `product-images` is public (`store-reports`, `store-requests`, `reimbursements` are private too), each allows at most 1 MB, and there is no `avatars` bucket (avatars come from Google), so `avatar` is not a purpose. In Chrome, on the same 4000×3000 photo (5.6 MB): v1's library 184 KB in 391 ms, v2 98 KB in 160 ms, both 1080×810 WebP; 0.6 s at 20× slower CPU, in a worker on phones. Not yet seen: Supabase Storage itself (needs SUPABASE_SECRET_KEY).**

## The goal

Every photo in both apps (close-day photos, expenses, reports, product images, avatars, payroll proofs) goes the same way: shrunk on the phone, uploaded straight to Supabase Storage with a signed address from Go, retried when the signal drops. One component, one route, one rule for who may see what.
RFC: At a glance (photo uploads, signed URLs), Supabase stays for files. Build order Step 17c (moved from Step 18: both apps upload).

## Where it stands today

- The old app's buckets: `daily-photos` (private, close day), `payroll-proofs`, `product-images`, `avatars`; it signs URLs through supabase-js on the server
- v2's Go has only Supabase's publishable key (sign-in); signing uploads needs the secret key

## The plan

1. **Go signs, the phone uploads:** `POST /api/files/upload` (signed in, per tenant) takes what the file is for (`purpose`: `daily_photo`, `expense`, `report`, `product_image`, `avatar`, `payroll_proof`) and its size; Go checks the caller may upload that kind, picks the bucket and a path (`<tenant>/<purpose>/<date>/<uuid>.webp`, never the phone's file name), and returns a signed upload URL valid for a few minutes. The phone PUTs the file straight to Supabase: the photo never passes through Railway
2. **The same buckets as v1** (`daily-photos`, `payroll-proofs`, `product-images`, `avatars`, `store-reports`, `store-requests`; shared while both apps run), read the way v1 reads them: public addresses where v1 uses them, a short-lived signed read URL from Go for private ones (`daily-photos`), only for callers allowed to see it (one helper, `internal/files`)
3. **Shrunk on the phone first, as v1 does** (owner, 2026-10-24: keep v1's settings, as small as possible): longest side 1080 px, WebP at quality 0.6 (JPEG at 0.7 where WebP encoding is missing, as on iOS), at most 0.4 MB (if still larger, encoded again at a lower quality), orientation from the photo's own data, and photos wider than 4:3 (or taller than 3:4) cropped to it. Three changes from v1: **no library** (v1 uses `browser-image-compression`, about 20 KB; the browser's own `createImageBitmap` and canvas do the same, off the main thread where `OffscreenCanvas` exists); **straight to Supabase** (v1 sends each photo through a Vercel route, phone → Vercel → Supabase, twice over slow 4G); **the crop in both apps** (v1 crops in seller only). In `packages/ui` `PhotoInput`, its code loaded only when a photo is taken. A camera photo leaves at about 100-300 KB
4. **Retried:** an upload that fails (no signal, timeout) is tried again with backoff while the app is open, with its progress shown; the screen's save waits for it. The file is kept in memory, not on the phone (offline queues come after every store runs v2)
5. **Secret key:** `SUPABASE_SECRET_KEY` for `api` (Infisical, `preserve()`); config refuses to start the API without it, like the other secrets
6. **Tests:** integration tests against a fake Storage: a seller cannot get an upload URL for another tenant, nor for a purpose their role may not upload; paths never contain the phone's file name; a read URL is only signed for an allowed caller. A browser check that a 4000×3000 photo leaves the phone under 0.4 MB, and no larger than v1's for the same photo, measured on the 20× throttled profile for the time it takes

## Owner's part

- **Supabase:** the project's secret key (Project settings → API keys → Secret key; for staging and production) into Infisical `staging` and `prod`, path `/app`, as `SUPABASE_SECRET_KEY`. I'll write the clicks

## Done when

- One photo through the whole path on staging: shrunk on the phone, uploaded straight to Storage, shown back through a signed read URL
- A photo taken on a 20× throttled profile is shrunk without freezing the screen, and leaves at under 0.4 MB, the same size as v1's
- An upload interrupted halfway (network cut in DevTools) finishes by itself when the network returns
- A seller of another tenant gets 403 for an upload URL and for a read URL

## Not in this task

- The screens that take photos: with their features (Step 18 stores and products, Step 31 close day, Step 32 reports)
- Offline uploads (kept on the phone until the network returns): after every store runs v2
