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
