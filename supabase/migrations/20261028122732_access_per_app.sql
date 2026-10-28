-- Access per app (tea-pos v2, Step 47c): one account, and for each app a separate level. Only
-- additions, so v1 never notices: it keeps reading users.role, which Go keeps writing while v1 runs.

-- A member's level in one app; no row means no access there. Each app offers only some levels.
CREATE TABLE public.user_app_access (
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    app text NOT NULL,
    access text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id, app),
    FOREIGN KEY (tenant_id, user_id) REFERENCES public.user_tenant_assignments (tenant_id, user_id) ON DELETE CASCADE,
    CHECK ((app = 'seller' AND access = 'member') OR (app = 'backoffice' AND access IN ('guest', 'admin')))
);

-- Every request reads the caller's apps by user.
CREATE INDEX user_app_access_user_id_idx ON public.user_app_access (user_id, app);

-- Someone signed in asking to join a tenant; at most one waiting per person and tenant. Blocked
-- stays: that person's next ask is quietly dropped.
CREATE TABLE public.tenant_access_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'blocked')),
    created_at timestamptz NOT NULL DEFAULT now(),
    decided_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
    decided_at timestamptz
);

CREATE UNIQUE INDEX tenant_access_requests_pending_idx
    ON public.tenant_access_requests (tenant_id, user_id) WHERE status = 'pending';

-- Only Go's connection (which skips row-level security) reads them.
ALTER TABLE public.user_app_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_access_requests ENABLE ROW LEVEL SECURITY;

-- The owner never loses access, whatever the app rows say.
ALTER TABLE public.tenants ADD COLUMN owner_id uuid REFERENCES public.users (id) ON DELETE SET NULL;

-- Turned off in this tenant only; v1 never reads it.
ALTER TABLE public.user_tenant_assignments
    ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Backfill, only what is missing, so running it again (at the cutover) is harmless:
-- ADMIN is a seller member and a backoffice admin; USER a seller member.
INSERT INTO public.user_app_access (tenant_id, user_id, app, access)
SELECT a.tenant_id, a.user_id, v.app, v.access
FROM public.user_tenant_assignments a
JOIN public.users u ON u.id = a.user_id
JOIN (VALUES ('USER', 'seller', 'member'), ('ADMIN', 'seller', 'member'), ('ADMIN', 'backoffice', 'admin'))
    AS v (role, app, access) ON v.role = u.role
ON CONFLICT DO NOTHING;

-- Each tenant's earliest admin; the owner checks it in UAC.
UPDATE public.tenants t
SET owner_id = (
    SELECT a.user_id
    FROM public.user_tenant_assignments a
    JOIN public.users u ON u.id = a.user_id
    WHERE a.tenant_id = t.id AND u.role = 'ADMIN'
    ORDER BY a.created_at, a.user_id
    LIMIT 1
)
WHERE t.owner_id IS NULL;
