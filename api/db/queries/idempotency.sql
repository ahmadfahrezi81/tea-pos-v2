-- name: ClaimIdempotencyKey :execrows
-- 1 when this request is the first with its key; 0 when one came before (it waits for that
-- one's transaction, so two at once run once).
INSERT INTO idempotency_keys (user_id, key, request_hash) VALUES ($1, $2, $3)
ON CONFLICT DO NOTHING;

-- name: GetIdempotentAnswer :one
SELECT request_hash, status, content_type, body FROM idempotency_keys
WHERE user_id = $1 AND key = $2;

-- name: SaveIdempotentAnswer :exec
UPDATE idempotency_keys SET status = $3, content_type = $4, body = $5
WHERE user_id = $1 AND key = $2;

-- name: DeleteOldIdempotencyKeys :execrows
DELETE FROM idempotency_keys WHERE created_at < now() - interval '24 hours';
