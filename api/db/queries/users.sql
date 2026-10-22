-- name: GetUserForSignIn :one
SELECT id, role, status FROM users WHERE id = $1;

-- name: SetUserAvatar :exec
UPDATE users SET avatar_url = $2 WHERE id = $1;

-- name: GetUserTenant :one
-- The tenant behind a slug, only if the user is assigned to it.
SELECT t.id
FROM tenants t
JOIN user_tenant_assignments a ON a.tenant_id = t.id
WHERE t.slug = $1 AND a.user_id = $2;
