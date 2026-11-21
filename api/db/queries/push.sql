-- name: UpsertPushSubscription :exec
-- A phone's subscription, asked again on every start: one row per endpoint, whoever holds it now.
INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, app)
VALUES (@user_id, @endpoint, @p256dh, @auth, @user_agent, @app)
ON CONFLICT (endpoint) DO UPDATE
SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    user_agent = excluded.user_agent, app = excluded.app, last_seen_at = now();

-- name: DeletePushSubscription :exec
DELETE FROM push_subscriptions WHERE endpoint = @endpoint AND user_id = @user_id;

-- name: DeleteGonePushSubscription :exec
-- The push service answered 404 or 410: the phone dropped it.
DELETE FROM push_subscriptions WHERE endpoint = @endpoint;

-- name: LatestChatMessage :one
-- What a channel's push says: its newest message, the channel and the tenant.
SELECT m.id, m.author_type, m.author_id, m.body, m.created_at,
    coalesce(m.event_type, '')::text AS event_type, m.metadata,
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
-- level) and have not read it yet, with each of their phones (one app per phone), even with
-- the app open.
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
  AND (CASE c.kind
    WHEN 'general' THEN true
    WHEN 'admin' THEN t.owner_id = a.user_id OR x.access IN ('vip', 'admin')
    WHEN 'personal' THEN a.user_id = c.user_id
    WHEN 'store' THEN EXISTS (SELECT 1 FROM user_store_assignments sa WHERE sa.store_id = c.store_id AND sa.user_id = a.user_id)
    WHEN 'group' THEN EXISTS (SELECT 1 FROM chat_channel_members gm WHERE gm.channel_id = c.id AND gm.user_id = a.user_id)
    ELSE false
  END OR (r.followed_at IS NOT NULL AND c.kind <> 'personal' AND (t.owner_id = a.user_id OR x.access = 'admin')))
  AND u.id IS DISTINCT FROM @author_id::uuid
  AND coalesce(r.notify_level, 'all') <> 'none'
  AND NOT (coalesce(r.notify_level, 'all') = 'humans' AND @system::bool)
  AND coalesce(r.last_read_at, '-infinity') < @at::timestamptz
  -- One app per phone (task 068d): with Tea-POS and Tea-Office both subscribed on one phone (the
  -- same user agent), only the app this person used last gets it.
  AND NOT EXISTS (
    SELECT 1 FROM push_subscriptions other
    WHERE other.user_id = ps.user_id AND other.user_agent = ps.user_agent
      AND other.app IS NOT NULL AND ps.app IS NOT NULL AND other.app <> ps.app
      AND (SELECT max(s.last_seen_at) FROM sessions s WHERE s.user_id = ps.user_id AND s.app = other.app)
        > coalesce((SELECT max(s.last_seen_at) FROM sessions s WHERE s.user_id = ps.user_id AND s.app = ps.app), '-infinity')
  );

-- name: ClaimChatPush :one
-- Marks a channel's newest message as pushed; no row when another job already pushed it.
UPDATE chat_channels SET last_pushed_message_id = @message_id
WHERE id = @channel_id AND last_pushed_message_id IS DISTINCT FROM @message_id
RETURNING id;
