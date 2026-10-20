-- Enable pg_cron (if not already enabled via dashboard)
-- Note: on Supabase hosted projects, pg_cron also needs to be enabled in the
-- dashboard (Database → Extensions) before this migration runs. The line below
-- handles it in code but Supabase's extension system may require the dashboard
-- step first. Safe to have both.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Job 1: midnight WIB (00:00 WIB = 17:00 UTC)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'end-stale-sessions-midnight') THEN
        PERFORM cron.schedule(
            'end-stale-sessions-midnight',
            '0 17 * * *',
            $job$
            UPDATE store_sessions
            SET status = 'ended', ended_at = NOW()
            WHERE status = 'active'
            AND daily_summary_id IN (
                SELECT id FROM store_daily_summaries
                WHERE date < (NOW() + INTERVAL '7 hours')::date
            );
            $job$
        );
    END IF;
END $$;

-- Job 2: 5am WIB (05:00 WIB = 22:00 UTC) — safety net before stores open
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'end-stale-sessions-morning') THEN
        PERFORM cron.schedule(
            'end-stale-sessions-morning',
            '0 22 * * *',
            $job$
            UPDATE store_sessions
            SET status = 'ended', ended_at = NOW()
            WHERE status = 'active'
            AND daily_summary_id IN (
                SELECT id FROM store_daily_summaries
                WHERE date < (NOW() + INTERVAL '7 hours')::date
            );
            $job$
        );
    END IF;
END $$;
