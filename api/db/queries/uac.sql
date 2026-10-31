-- name: ListTenantPeople :many
-- Everyone in the tenant with what auth.LevelIn reads, and their stores here.
SELECT u.id, u.full_name, u.email, COALESCE(u.avatar_url, '')::text AS avatar_url, u.role,
    COALESCE(u.phone_number, '')::text AS phone, u.created_at,
    a.status, coalesce(t.owner_id = u.id, false)::bool AS is_owner,
    coalesce((SELECT x.access FROM user_app_access x WHERE x.tenant_id = a.tenant_id AND x.user_id = u.id AND x.app = 'seller'), '')::text AS seller_access,
    coalesce((SELECT x.access FROM user_app_access x WHERE x.tenant_id = a.tenant_id AND x.user_id = u.id AND x.app = 'backoffice'), '')::text AS backoffice_access,
    (a.levels_set OR EXISTS (SELECT 1 FROM user_app_access x WHERE x.tenant_id = a.tenant_id AND x.user_id = u.id))::bool AS has_levels,
    coalesce(c.id::text, '')::text AS commission_type_id,
    coalesce(c.name, '')::text AS commission_name,
    coalesce(c.rate_per_cup, 0)::bigint AS commission_rate,
    coalesce(ARRAY(
        SELECT e.claim_config_id FROM payroll_user_claim_assignments e
        JOIN payroll_claim_configs cc ON cc.id = e.claim_config_id AND cc.is_enabled
        WHERE e.tenant_id = a.tenant_id AND e.user_id = u.id ORDER BY cc.name
    ), '{}')::uuid[] AS claim_type_ids,
    coalesce(ARRAY(
        SELECT s.id FROM user_store_assignments sa JOIN stores s ON s.id = sa.store_id
        WHERE sa.user_id = u.id AND s.tenant_id = a.tenant_id ORDER BY s.name
    ), '{}')::uuid[] AS store_ids
FROM user_tenant_assignments a
JOIN users u ON u.id = a.user_id
JOIN tenants t ON t.id = a.tenant_id
LEFT JOIN payroll_user_info i ON i.tenant_id = a.tenant_id AND i.user_id = a.user_id
LEFT JOIN payroll_commission_configs c ON c.id = i.commission_config_id
WHERE a.tenant_id = @tenant_id AND (sqlc.narg(user_id)::uuid IS NULL OR u.id = sqlc.narg(user_id))
ORDER BY a.status, u.full_name;

-- name: ListPendingRequests :many
SELECT r.id, r.user_id, r.created_at, u.full_name, u.email, COALESCE(u.avatar_url, '')::text AS avatar_url
FROM tenant_access_requests r
JOIN users u ON u.id = r.user_id
WHERE r.tenant_id = @tenant_id AND r.status = 'pending'
ORDER BY r.created_at;

-- name: SetAppAccess :exec
INSERT INTO user_app_access (tenant_id, user_id, app, access)
VALUES (@tenant_id, @user_id, @app, @access)
ON CONFLICT (tenant_id, user_id, app) DO UPDATE SET access = excluded.access, updated_at = now();

-- name: RemoveAppAccess :exec
DELETE FROM user_app_access WHERE tenant_id = @tenant_id AND user_id = @user_id AND app = @app;

-- name: SetMembershipStatus :execrows
UPDATE user_tenant_assignments SET status = @status, levels_set = true WHERE tenant_id = @tenant_id AND user_id = @user_id;

-- name: SetUserStores :exec
-- Exactly these of the tenant's stores; any other tenant's are left alone.
WITH wanted AS (SELECT unnest(@store_ids::uuid[]) AS store_id),
gone AS (
    DELETE FROM user_store_assignments sa
    USING stores s
    WHERE sa.store_id = s.id AND s.tenant_id = @tenant_id AND sa.user_id = @user_id
      AND sa.store_id NOT IN (SELECT store_id FROM wanted)
)
INSERT INTO user_store_assignments (user_id, store_id)
SELECT @user_id, w.store_id
FROM wanted w
JOIN stores s ON s.id = w.store_id AND s.tenant_id = @tenant_id
WHERE NOT EXISTS (SELECT 1 FROM user_store_assignments sa WHERE sa.user_id = @user_id AND sa.store_id = w.store_id);

-- name: SyncUserRole :exec
-- v1 reads users.role: ADMIN for an owner or a backoffice admin in any tenant, else USER. Other roles
-- (DRIVER, SUPPLIER) are left as they are. Goes when v1 retires.
UPDATE users u
SET role = CASE WHEN EXISTS (SELECT 1 FROM tenants t WHERE t.owner_id = u.id) OR EXISTS (
        SELECT 1 FROM user_app_access x
        JOIN user_tenant_assignments a ON a.tenant_id = x.tenant_id AND a.user_id = x.user_id AND a.status = 'active'
        WHERE x.user_id = u.id AND x.app = 'backoffice' AND x.access = 'admin'
    ) THEN 'ADMIN' ELSE 'USER' END,
    updated_at = now()
WHERE u.id = @user_id AND u.role IN ('USER', 'ADMIN');

-- name: SyncUserStatus :exec
-- v1's seller app locks out anyone whose users.status is not active: inactive once no tenant has them
-- active. Other statuses (pending, suspended) are left as they are. Goes when v1 retires.
UPDATE users u
SET status = CASE WHEN EXISTS (
        SELECT 1 FROM user_tenant_assignments a WHERE a.user_id = u.id AND a.status = 'active'
    ) THEN 'active' ELSE 'inactive' END,
    updated_at = now()
WHERE u.id = @user_id AND u.status IN ('active', 'inactive');


-- name: AskAccess :many
-- One waiting request per person and tenant; nothing for a member already in, someone blocked
-- there, or a slug that is no tenant. Returns the tenant only when a request was made.
INSERT INTO tenant_access_requests (tenant_id, user_id)
SELECT t.id, @user_id
FROM tenants t
WHERE t.slug = @slug
  AND NOT EXISTS (
    SELECT 1 FROM user_tenant_assignments a
    WHERE a.tenant_id = t.id AND a.user_id = @user_id AND a.status = 'active'
  )
  AND NOT EXISTS (
    SELECT 1 FROM tenant_access_requests r
    WHERE r.tenant_id = t.id AND r.user_id = @user_id AND r.status = 'blocked'
  )
ON CONFLICT DO NOTHING
RETURNING tenant_id;

-- name: GetPendingRequest :one
SELECT r.id, r.user_id, u.full_name, u.email, COALESCE(u.avatar_url, '')::text AS avatar_url, r.created_at
FROM tenant_access_requests r
JOIN users u ON u.id = r.user_id
WHERE r.id = @id AND r.tenant_id = @tenant_id AND r.status = 'pending';

-- name: DecideRequest :execrows
UPDATE tenant_access_requests
SET status = @status, decided_by = @decided_by, decided_at = now()
WHERE id = @id AND tenant_id = @tenant_id AND status = 'pending';

-- name: AddMember :exec
-- In the tenant, active; someone turned off before comes back on.
WITH back AS (
    UPDATE user_tenant_assignments SET status = 'active'
    WHERE tenant_id = @tenant_id AND user_id = @user_id
    RETURNING 1
)
INSERT INTO user_tenant_assignments (tenant_id, user_id)
SELECT @tenant_id, @user_id
WHERE NOT EXISTS (SELECT 1 FROM back);

-- name: ActivateUser :exec
-- A pending account let into a tenant is active, so v1 lets them in too.
UPDATE users SET status = 'active', updated_at = now() WHERE id = $1 AND status = 'pending';
