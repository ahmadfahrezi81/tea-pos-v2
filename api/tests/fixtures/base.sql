-- Shared by every integration test. Grows with each slice.
INSERT INTO public.tenants (id, name, slug) VALUES
    ('00000000-0000-0000-0000-00000000000a', 'Tenant A', 'tenant-a'),
    ('00000000-0000-0000-0000-00000000000b', 'Tenant B', 'tenant-b');
