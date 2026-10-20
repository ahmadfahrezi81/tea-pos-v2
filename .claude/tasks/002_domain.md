# Task 002 — The domain

**Status: done 2026-10-20. `lykostech.app` registered on Cloudflare (expires 2027-10-20, auto-renew on, Cloudflare nameservers). Always Use HTTPS and HTTP/3 on. The first purchase failed on Cloudflare's side and was refunded; the second went through.**

## The goal

Own `lykostech.app` on Cloudflare, so the apps launch on their final address from day one (a PWA is tied to its address).
RFC: Build order Step 2.

## Owner's part

1. Cloudflare dashboard → **Domain Registration → Register Domains**, search `lykostech.app`, buy it (about $14 a year, at cost). Auto-renew on; WHOIS privacy is on by default
2. The domain appears under **Websites** as an active zone by itself (no nameserver change: Cloudflare is the registrar)
3. On the zone, check these are on (most are by default):
   - **SSL/TLS → Edge Certificates:** Always Use HTTPS
   - **Speed → Optimization → Protocol:** HTTP/3
   - Brotli is always on for Cloudflare now; nothing to switch
4. Tell me the zone is active

`.app` only works over HTTPS (browsers force it), which suits us: Cloudflare gives the certificates.

## Done when

- `lykostech.app` shows as active in Cloudflare, auto-renew on
- HTTP/3 and Always Use HTTPS on

## Not in this task

DNS records for `tea-pos.` and `tea-office.`: they point at the Pages projects, so they come with Step 13. The company site at `lykostech.app` is outside this project.
