-- name: UpsertPushSubscription :exec
-- A phone's subscription, asked again on every start: one row per endpoint, whoever holds it now.
INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
VALUES (@user_id, @endpoint, @p256dh, @auth, @user_agent)
ON CONFLICT (endpoint) DO UPDATE
SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    user_agent = excluded.user_agent, last_seen_at = now();

-- name: DeletePushSubscription :exec
DELETE FROM push_subscriptions WHERE endpoint = @endpoint AND user_id = @user_id;

-- name: DeleteGonePushSubscription :exec
-- The push service answered 404 or 410: the phone dropped it.
DELETE FROM push_subscriptions WHERE endpoint = @endpoint;

-- name: LatestChatMessage :one
-- What a channel's push says: its newest message, the channel and the tenant.
SELECT m.id, m.author_type, m.author_id, m.body, m.created_at,
    coalesce(u.full_name, '')::text AS author_name, coalesce(u.avatar_url, '')::text AS author_avatar,
    (SELECT count(*) FROM chat_message_photos p WHERE p.message_id = m.id)::int AS photos,
    c.kind, coalesce(s.name, c.name, '')::text AS channel_name, t.slug
FROM chat_messages m
JOIN chat_channels c ON c.id = m.channel_id
JOIN tenants t ON t.id = c.tenant_id
LEFT JOIN stores s ON s.id = c.store_id
LEFT JOIN users u ON u.id = m.author_id
WHERE m.channel_id = @channel_id AND m.deleted_at IS NULL
ORDER BY m.created_at DESC, m.id DESC
LIMIT 1;

-- name: ChatPushTargets :many
-- Who a channel's newest message is pushed to: its members but the author, who want it (their
-- level), have not read it, and are not reading the channel right now (a read mark in the last
-- 30 seconds), with each of their phones.
SELECT u.id AS user_id, u.preferred_language, ps.endpoint, ps.p256dh, ps.auth
FROM chat_channels c
JOIN tenants t ON t.id = c.tenant_id
JOIN user_tenant_assignments a ON a.tenant_id = c.tenant_id AND a.status = 'active'
JOIN users u ON u.id = a.user_id
JOIN push_subscriptions ps ON ps.user_id = u.id
LEFT JOIN user_app_access x ON x.tenant_id = c.tenant_id AND x.user_id = a.user_id AND x.app = 'chat'
LEFT JOIN chat_reads r ON r.channel_id = c.id AND r.user_id = a.user_id
WHERE c.id = @channel_id
  AND (t.owner_id = a.user_id OR x.access IS NOT NULL)
  AND CASE c.kind
    WHEN 'general' THEN true
    WHEN 'admin' THEN t.owner_id = a.user_id OR x.access IN ('vip', 'admin')
    WHEN 'personal' THEN a.user_id = c.user_id
    WHEN 'store' THEN EXISTS (SELECT 1 FROM user_store_assignments sa WHERE sa.store_id = c.store_id AND sa.user_id = a.user_id)
    ELSE false
  END
  AND u.id IS DISTINCT FROM @author_id::uuid
  AND coalesce(r.notify_level, 'all') <> 'none'
  AND NOT (coalesce(r.notify_level, 'all') = 'humans' AND @system::bool)
  AND coalesce(r.last_read_at, '-infinity') < @at::timestamptz
  AND coalesce(r.updated_at, '-infinity') < now() - interval '30 seconds';

-- name: ClaimChatPush :one
-- Marks a channel's newest message as pushed; no row when another job already pushed it.
UPDATE chat_channels SET last_pushed_message_id = @message_id
WHERE id = @channel_id AND last_pushed_message_id IS DISTINCT FROM @message_id
RETURNING id;
