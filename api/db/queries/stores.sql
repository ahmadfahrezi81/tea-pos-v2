-- name: ListStoreSettings :many
-- Every store of the tenant, for Store settings: active, then demo, then inactive.
SELECT id, name, coalesce(address, '')::text AS address, latitude, longitude, status, open_time, close_time
FROM stores
WHERE tenant_id = $1
ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'fake' THEN 1 ELSE 2 END, name;

-- name: GetStoreSettings :one
SELECT id, name, coalesce(address, '')::text AS address, latitude, longitude, status, open_time, close_time
FROM stores
WHERE id = @id AND tenant_id = @tenant_id;

-- name: CreateStore :one
INSERT INTO stores (tenant_id, name, address, latitude, longitude, status, open_time, close_time)
VALUES (@tenant_id, @name, nullif(@address::text, ''), sqlc.narg(latitude), sqlc.narg(longitude), @status, @open_time, @close_time)
RETURNING id;

-- name: UpdateStore :execrows
UPDATE stores
SET name = @name, address = nullif(@address::text, ''), latitude = sqlc.narg(latitude), longitude = sqlc.narg(longitude),
    status = @status, open_time = @open_time, close_time = @close_time, updated_at = now()
WHERE id = @id AND tenant_id = @tenant_id;

-- name: DeleteStore :execrows
-- Only a store with nothing recorded: every table that keeps history refuses it (no cascade).
DELETE FROM stores WHERE id = @id AND tenant_id = @tenant_id;
