-- The fake users staging's end-to-end tests sign in as, through the test sign-in.
-- Run before every e2e run; safe to run again. Touches only test- tenants, never real data.
-- Ids: 0000e2e0-...-T where T is the tenant's letter.

INSERT INTO public.tenants (id, name, slug) VALUES
    ('0000e2e0-0000-0000-0000-00000000000a', 'Test A', 'test-a'),
    ('0000e2e0-0000-0000-0000-00000000000b', 'Test B', 'test-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.stores (id, tenant_id, name, status) VALUES
    ('0000e2e0-0000-0000-0010-00000000000a', '0000e2e0-0000-0000-0000-00000000000a', 'Test A Central', 'active'),
    ('0000e2e0-0000-0000-0011-00000000000a', '0000e2e0-0000-0000-0000-00000000000a', 'Test A North', 'active'),
    ('0000e2e0-0000-0000-0010-00000000000b', '0000e2e0-0000-0000-0000-00000000000b', 'Test B Central', 'active'),
    ('0000e2e0-0000-0000-0011-00000000000b', '0000e2e0-0000-0000-0000-00000000000b', 'Test B North', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email) VALUES
    ('0000e2e0-0000-0000-0001-00000000000a', 'seller@test-a.test'),
    ('0000e2e0-0000-0000-0002-00000000000a', 'admin@test-a.test'),
    ('0000e2e0-0000-0000-0003-00000000000a', 'inactive@test-a.test'),
    ('0000e2e0-0000-0000-0001-00000000000b', 'seller@test-b.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, email, full_name, role, status) VALUES
    ('0000e2e0-0000-0000-0001-00000000000a', 'seller@test-a.test', 'Test Seller A', 'USER', 'active'),
    ('0000e2e0-0000-0000-0002-00000000000a', 'admin@test-a.test', 'Test Admin A', 'ADMIN', 'active'),
    ('0000e2e0-0000-0000-0003-00000000000a', 'inactive@test-a.test', 'Test Inactive A', 'USER', 'inactive'),
    ('0000e2e0-0000-0000-0001-00000000000b', 'seller@test-b.test', 'Test Seller B', 'USER', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_tenant_assignments (tenant_id, user_id) VALUES
    ('0000e2e0-0000-0000-0000-00000000000a', '0000e2e0-0000-0000-0001-00000000000a'),
    ('0000e2e0-0000-0000-0000-00000000000a', '0000e2e0-0000-0000-0002-00000000000a'),
    ('0000e2e0-0000-0000-0000-00000000000a', '0000e2e0-0000-0000-0003-00000000000a'),
    ('0000e2e0-0000-0000-0000-00000000000b', '0000e2e0-0000-0000-0001-00000000000b')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Seller A works at Central (default) only; Seller B at B Central.
INSERT INTO public.user_store_assignments (user_id, store_id, is_default) VALUES
    ('0000e2e0-0000-0000-0001-00000000000a', '0000e2e0-0000-0000-0010-00000000000a', true),
    ('0000e2e0-0000-0000-0001-00000000000b', '0000e2e0-0000-0000-0010-00000000000b', true)
ON CONFLICT (user_id, store_id) DO NOTHING;

-- Test A's last 60 days of closed days (and today open), so the Store tab has something to
-- show: made up, the same numbers for a date every run. New days are added as days pass.
INSERT INTO public.store_daily_summaries
    (store_id, tenant_id, opened_by, date, total_sales, total_orders, total_cups, expected_cash, actual_cash, variance, created_at, closed_at)
SELECT s.id, '0000e2e0-0000-0000-0000-00000000000a', '0000e2e0-0000-0000-0001-00000000000a', d::date,
    cups * 8000, cups * 7 / 10, cups, cups * 8000, cups * 8000, 0,
    -- Opened 08:00 and closed 22:00 WIB, held as UTC like the old app's; today stays open.
    d + interval '1 hour',
    CASE WHEN d::date < (now() AT TIME ZONE 'Asia/Jakarta')::date THEN d + interval '15 hours' END
FROM (VALUES ('0000e2e0-0000-0000-0010-00000000000a'::uuid, 60), ('0000e2e0-0000-0000-0011-00000000000a'::uuid, 35)) AS s (id, base),
    generate_series((now() AT TIME ZONE 'Asia/Jakarta')::date - 60, (now() AT TIME ZONE 'Asia/Jakarta')::date, interval '1 day') AS d,
    LATERAL (SELECT s.base + (extract(doy FROM d)::int * 37 % 41) AS cups) AS c
ON CONFLICT (store_id, date) DO UPDATE SET created_at = EXCLUDED.created_at, closed_at = EXCLUDED.closed_at;

-- A product and the last 3 days' orders at Test A Central (made up, the same ids every run), so
-- the Store tab's orders and a day's detail have something to show.
INSERT INTO public.tenant_products (id, tenant_id, name, price, status) VALUES
    ('0000e2e0-0000-0000-00e1-00000000000a', '0000e2e0-0000-0000-0000-00000000000a', 'Test Tea', 8000, 'active'),
    ('0000e2e0-0000-0000-00e2-00000000000a', '0000e2e0-0000-0000-0000-00000000000a', 'Test Milk Tea', 10000, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.store_orders (id, store_id, user_id, total_amount, tenant_id, daily_summary_id, created_at)
SELECT md5('e2e-order-' || d::date || '-' || n)::uuid, '0000e2e0-0000-0000-0010-00000000000a', '0000e2e0-0000-0000-0001-00000000000a',
    CASE WHEN n % 3 = 0 THEN 10000 ELSE 8000 * (1 + n % 2) END, '0000e2e0-0000-0000-0000-00000000000a', s.id,
    -- From 08:25 WIB, every 25 minutes; created_at holds UTC.
    d + interval '1 hour' + n * interval '25 minutes'
FROM generate_series((now() AT TIME ZONE 'Asia/Jakarta')::date - 2, (now() AT TIME ZONE 'Asia/Jakarta')::date, interval '1 day') AS d,
    generate_series(1, 20) AS n,
    LATERAL (SELECT id FROM public.store_daily_summaries
        WHERE store_id = '0000e2e0-0000-0000-0010-00000000000a' AND date = d::date) AS s
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.store_order_items (id, order_id, product_id, quantity, unit_price, total_price, tenant_id)
SELECT md5('e2e-item-' || o.id)::uuid, o.id,
    CASE WHEN o.total_amount = 10000 THEN '0000e2e0-0000-0000-00e2-00000000000a'::uuid ELSE '0000e2e0-0000-0000-00e1-00000000000a'::uuid END,
    CASE WHEN o.total_amount = 10000 THEN 1 ELSE o.total_amount / 8000 END,
    CASE WHEN o.total_amount = 10000 THEN 10000 ELSE 8000 END, o.total_amount, o.tenant_id
FROM public.store_orders o
WHERE o.tenant_id = '0000e2e0-0000-0000-0000-00000000000a'
ON CONFLICT (id) DO NOTHING;
