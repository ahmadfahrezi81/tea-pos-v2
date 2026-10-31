-- Levels were set here: no level rows then means None in every app, not users.role. Only an
-- addition, so v1 never notices; goes with the fallback when v1 retires.
ALTER TABLE public.user_tenant_assignments ADD COLUMN levels_set boolean NOT NULL DEFAULT false;

-- Everyone turned off before now has None too, kept if they are turned back on.
DELETE FROM public.user_app_access x
USING public.user_tenant_assignments a
WHERE a.tenant_id = x.tenant_id AND a.user_id = x.user_id AND a.status = 'inactive';

UPDATE public.user_tenant_assignments SET levels_set = true
WHERE status = 'inactive' AND NOT levels_set;
