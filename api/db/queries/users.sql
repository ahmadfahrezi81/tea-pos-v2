-- name: GetUserForSignIn :one
SELECT u.id, u.role, u.status, coalesce(ARRAY(SELECT DISTINCT x.app FROM user_app_access x WHERE x.user_id = u.id), '{}')::text[] AS apps
FROM users u WHERE u.id = $1;

-- name: SetUserAvatar :exec
UPDATE users SET avatar_url = $2 WHERE id = $1;

-- name: GetUserTenant :one
-- The tenant behind a slug, only if the user is assigned to it, with their membership, whether they
-- own it, their level in the app ('' for none) and whether their levels were ever set there
-- (people v1 added after the backfill have not: Go falls back to users.role for them).
SELECT t.id, a.status, coalesce(t.owner_id = a.user_id, false)::bool AS is_owner,
    coalesce((
        SELECT x.access FROM user_app_access x
        WHERE x.tenant_id = t.id AND x.user_id = a.user_id AND x.app = sqlc.arg(app)::text
    ), '')::text AS access,
    (a.levels_set OR EXISTS (
        SELECT 1 FROM user_app_access x WHERE x.tenant_id = t.id AND x.user_id = a.user_id
    ))::bool AS has_levels,
    (SELECT u.status FROM users u WHERE u.id = a.user_id)::text AS user_status
FROM tenants t
JOIN user_tenant_assignments a ON a.tenant_id = t.id
WHERE t.slug = sqlc.arg(slug) AND a.user_id = sqlc.arg(user_id);

-- name: GetTestUser :one
-- Only users who belong to test tenants alone (slug test-...): the staging test sign-in reaches no one else.
SELECT u.id, u.role, u.status, coalesce(ARRAY(SELECT DISTINCT x.app FROM user_app_access x WHERE x.user_id = u.id), '{}')::text[] AS apps
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

-- name: CreatePendingUser :exec
-- Someone new: an account in no tenant and no app, waiting until a tenant lets them in. v1 lets
-- a pending account in nowhere either.
INSERT INTO users (id, email, full_name, role, status, avatar_url)
VALUES (@id, @email, @full_name, 'USER', 'pending', sqlc.narg(avatar_url))
ON CONFLICT (id) DO NOTHING;
