-- name: CreateSession :exec
INSERT INTO sessions (token_hash, user_id, app, expires_at, ip, user_agent)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: GetSession :one
-- The caller's session with the user's current role, status and apps, so a change
-- applies without signing in again.
SELECT s.id, s.user_id, s.app, s.last_seen_at, s.expires_at, u.role, u.status,
    coalesce(ARRAY(SELECT DISTINCT x.app FROM user_app_access x WHERE x.user_id = u.id), '{}')::text[] AS apps
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.token_hash = $1 AND s.expires_at > now();

-- name: RenewSession :exec
UPDATE sessions SET last_seen_at = now(), expires_at = $2 WHERE id = $1;

-- name: DeleteSession :exec
DELETE FROM sessions WHERE token_hash = $1;

-- name: DeleteUserSessions :exec
-- Signing out everywhere: every app, every phone.
DELETE FROM sessions WHERE user_id = $1;
