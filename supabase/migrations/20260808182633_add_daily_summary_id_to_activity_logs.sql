-- Task 044, Item 1 — give tenant_activity_logs the column every other child of
-- a daily summary already has.
--
-- getDayActivity currently rebuilds the summary -> events link on every request:
-- seven parallel queries whose only purpose is collecting child row ids, then
-- `.in("ref_id", <every id>)`. Five of those seven are literally
-- `.eq("daily_summary_id", summary_id)` against tables that carry the column.
-- This is the one that doesn't.
--
-- Nullable on purpose, permanently. Payroll and customer-feedback events
-- genuinely have no summary, and events logged after their child row was
-- deleted cannot be linked to one. Do not plan to tighten this to NOT NULL.
--
-- `on delete set null`: an audit log must never block a business operation.
-- Nothing deletes a summary today, which is exactly why the case wants a
-- deliberate answer rather than the NO ACTION default.

alter table tenant_activity_logs
    add column daily_summary_id uuid
        references store_daily_summaries(id) on delete set null;

create index if not exists tenant_activity_logs_tenant_summary_idx
    on tenant_activity_logs (tenant_id, daily_summary_id);

-- Backfill. Every log row reaches its summary the same way: match ref_table +
-- ref_id against the table it names, and take that row's daily_summary_id. For
-- store_daily_summaries the ref_id IS the summary, so it joins to its own id.
--
-- No `daily_summary_id is null` guard — the column was created two statements
-- ago and is empty by construction.
--
-- No null-ref_table branch: verified 2026-08-09 that all 10,453 rows carry one.
-- No date-based fallback for orders: 361 orders have a null daily_summary_id,
-- none of them resolve by date, and none of them have an order_created log
-- (they predate activity logging). A fallback would match zero rows.
--
-- store_requests and store_reports have no log rows yet. The branches stay
-- because requests.ts:38 and reports.ts:38 write those types.

update tenant_activity_logs l
set daily_summary_id = c.summary_id
from (
    select id, id              as summary_id, 'store_daily_summaries'      as tbl from store_daily_summaries
    union all select id, daily_summary_id, 'store_daily_summary_photos' from store_daily_summary_photos
    union all select id, daily_summary_id, 'store_expenses'             from store_expenses
    union all select id, daily_summary_id, 'store_sessions'             from store_sessions
    union all select id, daily_summary_id, 'store_requests'             from store_requests
    union all select id, daily_summary_id, 'store_reports'              from store_reports
    union all select id, daily_summary_id, 'store_orders'               from store_orders
) c
where l.ref_table  = c.tbl
  and l.ref_id     = c.id
  and c.summary_id is not null;

-- Expected after this runs: 422 rows still null — payroll 409, customer
-- feedback 11, summary_photo_deleted 2 (child row already gone). Anything else
-- is an event type that will disappear from the day timeline once
-- getDayActivity switches to keying on this column.
--
--   select type,
--          count(*) filter (where daily_summary_id is null) as unlinked,
--          count(*) as total
--   from tenant_activity_logs
--   group by type
--   order by unlinked desc;
