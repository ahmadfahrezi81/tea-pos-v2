-- name: GetMe :one
SELECT id, email, full_name, role, avatar_url, preferred_language, phone_number, created_at FROM users WHERE id = $1;

-- name: ListUserTenants :many
-- The tenants the user is an active member of, with what auth.LevelIn reads.
SELECT t.id, t.slug, t.name, t.pay_frequency, a.status,
    coalesce(t.owner_id = a.user_id, false)::bool AS is_owner,
    coalesce((
        SELECT x.access FROM user_app_access x
        WHERE x.tenant_id = t.id AND x.user_id = a.user_id AND x.app = 'seller'
    ), '')::text AS seller_access,
    coalesce((
        SELECT x.access FROM user_app_access x
        WHERE x.tenant_id = t.id AND x.user_id = a.user_id AND x.app = 'backoffice'
    ), '')::text AS backoffice_access,
    (a.levels_set OR EXISTS (
        SELECT 1 FROM user_app_access x WHERE x.tenant_id = t.id AND x.user_id = a.user_id
    ))::bool AS has_levels
FROM tenants t
JOIN user_tenant_assignments a ON a.tenant_id = t.id
WHERE a.user_id = $1 AND a.status = 'active'
ORDER BY t.name;

-- name: ListAssignedStores :many
-- The stores a user is rostered at, only in tenants they belong to (seller).
SELECT s.id, s.tenant_id, s.name, s.status, s.open_time, s.close_time, a.is_default
FROM user_store_assignments a
JOIN stores s ON s.id = a.store_id
JOIN user_tenant_assignments t ON t.tenant_id = s.tenant_id AND t.user_id = a.user_id
WHERE a.user_id = $1
ORDER BY s.name;

-- name: ListTenantStores :many
-- Every store of the user's tenants, retired and demo included (backoffice).
SELECT s.id, s.tenant_id, s.name, s.status, s.open_time, s.close_time,
    EXISTS (
        SELECT 1 FROM user_store_assignments a
        WHERE a.store_id = s.id AND a.user_id = $1 AND a.is_default
    ) AS is_default
FROM stores s
JOIN user_tenant_assignments t ON t.tenant_id = s.tenant_id
WHERE t.user_id = $1
ORDER BY s.name;

-- name: SetUserProfile :exec
-- Only what was sent changes; an empty phone clears it.
UPDATE users SET
    preferred_language = COALESCE(sqlc.narg(language), preferred_language),
    full_name = COALESCE(sqlc.narg(full_name), full_name),
    phone_number = CASE WHEN sqlc.narg(phone)::text IS NULL THEN phone_number ELSE NULLIF(sqlc.narg(phone)::text, '') END,
    updated_at = now()
WHERE id = @id;

-- name: ListAskedTenants :many
-- The tenants the user asked to join and is still waiting on (blocked looks the same to them).
SELECT DISTINCT t.slug
FROM tenant_access_requests r
JOIN tenants t ON t.id = r.tenant_id
WHERE r.user_id = $1 AND r.status IN ('pending', 'blocked')
ORDER BY t.slug;
