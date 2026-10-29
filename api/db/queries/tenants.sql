-- name: GetTenantBySlug :one
SELECT id, name, slug
FROM tenants
WHERE slug = $1;

-- name: StoreInTenant :one
SELECT EXISTS (SELECT 1 FROM stores WHERE id = $1 AND tenant_id = $2);
