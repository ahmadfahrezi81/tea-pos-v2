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

-- name: GetTestUser :one
-- Only users who belong to test tenants alone (slug test-...): the staging test sign-in reaches no one else.
SELECT u.id, u.role, u.status
FROM users u
WHERE u.email = $1
  AND EXISTS (
    SELECT 1 FROM user_tenant_assignments a JOIN tenants t ON t.id = a.tenant_id
    WHERE a.user_id = u.id AND t.slug LIKE 'test-%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_tenant_assignments a JOIN tenants t ON t.id = a.tenant_id
    WHERE a.user_id = u.id AND t.slug NOT LIKE 'test-%'
  );
