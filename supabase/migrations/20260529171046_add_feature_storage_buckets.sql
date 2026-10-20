-- Create new feature buckets (public, matching existing daily-photos behaviour)
INSERT INTO storage.buckets (id, name, public)
VALUES
    ('store-reports',  'store-reports',  true),
    ('store-requests', 'store-requests', true),
    ('reimbursements', 'reimbursements', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies — DO $$ guards because CREATE POLICY IF NOT EXISTS requires PG17;
-- Supabase runs PG15. Safe to re-run.

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload store-reports') THEN
        CREATE POLICY "Authenticated users can upload store-reports"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'store-reports');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store reports are publicly readable') THEN
        CREATE POLICY "Store reports are publicly readable"
        ON storage.objects FOR SELECT TO public
        USING (bucket_id = 'store-reports');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload store-requests') THEN
        CREATE POLICY "Authenticated users can upload store-requests"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'store-requests');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store requests are publicly readable') THEN
        CREATE POLICY "Store requests are publicly readable"
        ON storage.objects FOR SELECT TO public
        USING (bucket_id = 'store-requests');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload reimbursements') THEN
        CREATE POLICY "Authenticated users can upload reimbursements"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'reimbursements');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Reimbursements are publicly readable') THEN
        CREATE POLICY "Reimbursements are publicly readable"
        ON storage.objects FOR SELECT TO public
        USING (bucket_id = 'reimbursements');
    END IF;
END $$;
