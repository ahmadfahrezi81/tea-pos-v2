-- name: GetTenantBySlug :one
SELECT id, name, slug
FROM tenants
WHERE slug = $1;
