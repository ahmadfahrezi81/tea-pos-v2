-- Shared by every integration test. Grows with each slice.
INSERT INTO public.tenants (id, name, slug) VALUES
    ('00000000-0000-0000-0000-00000000000a', 'Tenant A', 'tenant-a'),
    ('00000000-0000-0000-0000-00000000000b', 'Tenant B', 'tenant-b'),
    -- A test tenant, as on staging: the only users the test sign-in may reach.
    ('00000000-0000-0000-0000-00000000000f', 'Test F', 'test-f');

-- One user per case the access checks distinguish. Ids end in a letter for the tenant.
INSERT INTO auth.users (id, email) VALUES
    ('00000000-0000-0000-0001-00000000000a', 'seller@a.test'),
    ('00000000-0000-0000-0002-00000000000a', 'admin@a.test'),
    ('00000000-0000-0000-0003-00000000000a', 'inactive@a.test'),
    ('00000000-0000-0000-0004-00000000000a', 'driver@a.test'),
    ('00000000-0000-0000-0001-00000000000b', 'seller@b.test'),
    ('00000000-0000-0000-0005-000000000000', 'none@test'),
    ('00000000-0000-0000-0001-00000000000f', 'seller@test-f.test'),
    ('00000000-0000-0000-0006-00000000000f', 'mixed@test-f.test');

INSERT INTO public.users (id, email, full_name, role, status) VALUES
    ('00000000-0000-0000-0001-00000000000a', 'seller@a.test', 'Seller A', 'USER', 'active'),
    ('00000000-0000-0000-0002-00000000000a', 'admin@a.test', 'Admin A', 'ADMIN', 'active'),
    ('00000000-0000-0000-0003-00000000000a', 'inactive@a.test', 'Inactive A', 'USER', 'inactive'),
    ('00000000-0000-0000-0004-00000000000a', 'driver@a.test', 'Driver A', 'DRIVER', 'active'),
    ('00000000-0000-0000-0001-00000000000b', 'seller@b.test', 'Seller B', 'USER', 'active'),
    ('00000000-0000-0000-0005-000000000000', 'none@test', 'No Tenant', 'USER', 'active'),
    ('00000000-0000-0000-0001-00000000000f', 'seller@test-f.test', 'Seller F', 'USER', 'active'),
    ('00000000-0000-0000-0006-00000000000f', 'mixed@test-f.test', 'Mixed F', 'USER', 'active');

INSERT INTO public.user_tenant_assignments (tenant_id, user_id) VALUES
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0001-00000000000a'),
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0002-00000000000a'),
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0003-00000000000a'),
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0004-00000000000a'),
    ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0001-00000000000b'),
    ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0001-00000000000f'),
    -- In a test tenant and a real one: the test sign-in must refuse it.
    ('00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0006-00000000000f'),
    ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0006-00000000000f');

-- Tenant A: two open stores and a closed one; Tenant B: one. Ids end in the tenant's letter.
INSERT INTO public.stores (id, tenant_id, name, status) VALUES
    ('00000000-0000-0000-0010-00000000000a', '00000000-0000-0000-0000-00000000000a', 'A Central', 'active'),
    ('00000000-0000-0000-0011-00000000000a', '00000000-0000-0000-0000-00000000000a', 'A North', 'active'),
    ('00000000-0000-0000-0012-00000000000a', '00000000-0000-0000-0000-00000000000a', 'A Closed', 'inactive'),
    ('00000000-0000-0000-0010-00000000000b', '00000000-0000-0000-0000-00000000000b', 'B Central', 'active');

-- Seller A works at Central (default) and North; Admin A is rostered at North only.
INSERT INTO public.user_store_assignments (user_id, store_id, is_default) VALUES
    ('00000000-0000-0000-0001-00000000000a', '00000000-0000-0000-0010-00000000000a', true),
    ('00000000-0000-0000-0001-00000000000a', '00000000-0000-0000-0011-00000000000a', false),
    ('00000000-0000-0000-0002-00000000000a', '00000000-0000-0000-0011-00000000000a', true),
    ('00000000-0000-0000-0001-00000000000b', '00000000-0000-0000-0010-00000000000b', true);
