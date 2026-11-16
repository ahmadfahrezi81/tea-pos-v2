# Task 067 — Chat: photos

**Status: built 2026-11-15 on `feat/chat-phase-1` (in the PR into staging, 2026-11-16), approved by the owner with the RFC that night. Bucket `chat-photos` made on staging (2026-11-16).**

## The goal

Phase 1, Step 67 of [RFC: Chat (v2)](https://app.notion.com/p/40595a71540581e7b86edc272f66b0c1): up to 4 photos in a message, cheap to scroll on slow 4G.

## The plan

1. **Migration**: `chat_message_photos` (message, position, path, preview path, width, height), in the same not-yet-run chat migration
2. **Go**: purpose `chat_photo` (private bucket `chat-photos`); a message takes `photos` (at most 4, only paths in the tenant's own folder), its body may then be empty; every page signs all its photos in one call (6 hours)
3. **Phone**: the camera button picks up to 4; each photo is shrunk twice on the phone (1080 px, about 0.4 MB, uncropped; and a 320 px preview) and both uploaded straight to Storage, once, kept across retries; the list loads previews only, width and height reserve the space, a tap opens the full photo. `shrinkPhoto` takes a longest side (`packages/ui/shrink`)

## Owner's part

- **Supabase → Storage → New bucket `chat-photos`, private, 1 MB limit** on staging (and production before a release with chat). Until then a photo shows "Not sent"
- With `scripts/local-db.sh` the photos go to staging's Storage, so the staging bucket is the one to make first

## Done when

- A photo sent from one phone shows on the other as a preview, and full on a tap

## Not in this task

A store's photo gallery (later).
