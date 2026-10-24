-- name: GetMe :one
SELECT id, email, full_name, role, avatar_url, preferred_language FROM users WHERE id = $1;

-- name: ListUserTenants :many
SELECT t.id, t.slug, t.name, t.pay_frequency
FROM tenants t
JOIN user_tenant_assignments a ON a.tenant_id = t.id
WHERE a.user_id = $1
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

-- name: SetUserLanguage :exec
UPDATE users SET preferred_language = $2 WHERE id = $1;
