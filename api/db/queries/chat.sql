-- Chat (RFC: Chat (v2)). Who is in a channel is decided here, the same way in every query:
-- an active member of the tenant with a chat level (the owner always), and by kind: everyone for
-- general, chat admins for admin, the person for personal, whoever works the store for a store's,
-- the people picked for a group. A chat admin may open any channel but someone's Notifications;
-- one they follow counts as theirs for badges, Activity and pushes (task 070).

-- name: EnsureChatChannels :exec
-- Makes whichever of the caller's channels do not exist yet: General, their Notifications, Admin
-- for a VIP (or admin: the VIP chat, kind admin), one per store they work (a chat admin: every
-- store, for Other channels). Reads only, once they all exist.
WITH want AS (
    SELECT 'general'::text AS kind, NULL::uuid AS store_id, NULL::uuid AS user_id
    UNION SELECT 'personal', NULL, @user_id::uuid
    UNION SELECT 'admin', NULL, NULL WHERE @chat_vip::bool
    UNION
    SELECT 'store', s.id, NULL
    FROM stores s
    WHERE s.tenant_id = @tenant_id AND (@chat_admin::bool OR EXISTS (
        SELECT 1 FROM user_store_assignments sa WHERE sa.store_id = s.id AND sa.user_id = @user_id
    ))
)
INSERT INTO chat_channels (tenant_id, kind, store_id, user_id)
SELECT @tenant_id, w.kind, w.store_id, w.user_id
FROM want w
WHERE NOT EXISTS (
    SELECT 1 FROM chat_channels c
    WHERE c.tenant_id = @tenant_id AND c.kind = w.kind
      AND c.store_id IS NOT DISTINCT FROM w.store_id AND c.user_id IS NOT DISTINCT FROM w.user_id
)
ON CONFLICT DO NOTHING;

-- name: ListChatChannels :many
-- The caller's channels, the newest message first: the name (a store's read live), the last
-- message, and how many unread (stops at 100: "99+"). A chat admin also gets every other
-- channel but someone's Notifications: member and following say which are theirs.
SELECT c.id, c.kind, coalesce(s.name, c.name, '')::text AS name,
    coalesce(s.status, 'active')::text AS store_status,
    (c.archived_at IS NOT NULL)::bool AS archived,
    (CASE c.kind
        WHEN 'general' THEN true
        WHEN 'admin' THEN @chat_vip::bool
        WHEN 'personal' THEN c.user_id = @user_id
        WHEN 'store' THEN EXISTS (SELECT 1 FROM user_store_assignments sa WHERE sa.store_id = c.store_id AND sa.user_id = @user_id)
        WHEN 'group' THEN EXISTS (SELECT 1 FROM chat_channel_members gm WHERE gm.channel_id = c.id AND gm.user_id = @user_id)
        ELSE false
    END)::bool AS member,
    (r.followed_at IS NOT NULL)::bool AS following,
    c.last_message_at,
    coalesce(m.body, '')::text AS last_body,
    coalesce(m.author_type, '')::text AS last_author_type,
    coalesce(m.event_type, '')::text AS last_event_type,
    coalesce(m.metadata, '{}')::jsonb AS last_metadata,
    coalesce(m.author_id = @user_id, false)::bool AS last_mine,
    coalesce(au.full_name, '')::text AS last_author,
    (m.deleted_at IS NOT NULL)::bool AS last_deleted,
    (SELECT count(*) FROM (
        SELECT 1 FROM chat_messages x
        WHERE x.channel_id = c.id AND x.created_at > coalesce(r.last_read_at, '-infinity')
          AND x.deleted_at IS NULL AND x.author_id IS DISTINCT FROM @user_id
        LIMIT 100
    ) unread)::int AS unread,
    -- Who is in it, the same rule as ListChatMembers: the line under its name.
    (SELECT count(*) FROM user_tenant_assignments ma
        LEFT JOIN user_app_access mx ON mx.tenant_id = ma.tenant_id AND mx.user_id = ma.user_id AND mx.app = 'chat'
        WHERE ma.tenant_id = c.tenant_id AND ma.status = 'active'
          AND (t.owner_id = ma.user_id OR mx.access IS NOT NULL)
          AND CASE c.kind
            WHEN 'general' THEN true
            WHEN 'admin' THEN t.owner_id = ma.user_id OR mx.access IN ('vip', 'admin')
            WHEN 'personal' THEN ma.user_id = c.user_id
            WHEN 'store' THEN EXISTS (SELECT 1 FROM user_store_assignments sa WHERE sa.store_id = c.store_id AND sa.user_id = ma.user_id)
            WHEN 'group' THEN EXISTS (SELECT 1 FROM chat_channel_members gm WHERE gm.channel_id = c.id AND gm.user_id = ma.user_id)
            ELSE false
          END
    )::int AS members
FROM chat_channels c
JOIN tenants t ON t.id = c.tenant_id
LEFT JOIN stores s ON s.id = c.store_id
LEFT JOIN chat_reads r ON r.channel_id = c.id AND r.user_id = @user_id
LEFT JOIN chat_messages m ON m.id = c.last_message_id
LEFT JOIN users au ON au.id = m.author_id
WHERE c.tenant_id = @tenant_id AND (CASE c.kind
        WHEN 'general' THEN true
        WHEN 'admin' THEN @chat_vip::bool
        WHEN 'personal' THEN c.user_id = @user_id
        WHEN 'store' THEN EXISTS (SELECT 1 FROM user_store_assignments sa WHERE sa.store_id = c.store_id AND sa.user_id = @user_id)
        WHEN 'group' THEN EXISTS (SELECT 1 FROM chat_channel_members gm WHERE gm.channel_id = c.id AND gm.user_id = @user_id)
        ELSE false
    END
    OR (@chat_admin::bool AND c.kind <> 'personal'))
ORDER BY c.last_message_at DESC NULLS LAST, c.kind, 3;

-- name: GetChatChannel :one
-- One channel, only if the caller is in it or a chat admin (the same rule as ListChatChannels).
SELECT c.id, c.kind, coalesce(s.name, c.name, '')::text AS name, coalesce(s.status, 'active')::text AS store_status,
    (c.archived_at IS NOT NULL)::bool AS archived,
    (CASE c.kind
        WHEN 'general' THEN true
        WHEN 'admin' THEN @chat_vip::bool
        WHEN 'personal' THEN c.user_id = @user_id
        WHEN 'store' THEN EXISTS (SELECT 1 FROM user_store_assignments sa WHERE sa.store_id = c.store_id AND sa.user_id = @user_id)
        WHEN 'group' THEN EXISTS (SELECT 1 FROM chat_channel_members gm WHERE gm.channel_id = c.id AND gm.user_id = @user_id)
        ELSE false
    END)::bool AS member,
    coalesce((SELECT r.followed_at IS NOT NULL FROM chat_reads r WHERE r.channel_id = c.id AND r.user_id = @user_id), false)::bool AS following
FROM chat_channels c
LEFT JOIN stores s ON s.id = c.store_id
WHERE c.id = @id AND c.tenant_id = @tenant_id AND (CASE c.kind
        WHEN 'general' THEN true
        WHEN 'admin' THEN @chat_vip::bool
        WHEN 'personal' THEN c.user_id = @user_id
        WHEN 'store' THEN EXISTS (SELECT 1 FROM user_store_assignments sa WHERE sa.store_id = c.store_id AND sa.user_id = @user_id)
        WHEN 'group' THEN EXISTS (SELECT 1 FROM chat_channel_members gm WHERE gm.channel_id = c.id AND gm.user_id = @user_id)
        ELSE false
    END
    OR (@chat_admin::bool AND c.kind <> 'personal'));

-- name: ListChatMembers :many
-- Everyone in a channel, with how far they have read: Seen by, Not yet, and who to tell. A chat
-- admin following it is told too (follower: not one of its members).
SELECT u.id, u.full_name, coalesce(u.avatar_url, '')::text AS avatar_url, r.last_read_at,
    coalesce(t.owner_id = a.user_id OR x.access = 'admin', false)::bool AS chat_admin,
    coalesce(t.owner_id = a.user_id OR x.access IN ('vip', 'admin'), false)::bool AS chat_vip,
    (NOT CASE c.kind
        WHEN 'general' THEN true
        WHEN 'admin' THEN t.owner_id = a.user_id OR x.access IN ('vip', 'admin')
        WHEN 'personal' THEN a.user_id = c.user_id
        WHEN 'store' THEN EXISTS (SELECT 1 FROM user_store_assignments sa WHERE sa.store_id = c.store_id AND sa.user_id = a.user_id)
        WHEN 'group' THEN EXISTS (SELECT 1 FROM chat_channel_members gm WHERE gm.channel_id = c.id AND gm.user_id = a.user_id)
        ELSE false
    END)::bool AS follower
FROM chat_channels c
JOIN tenants t ON t.id = c.tenant_id
JOIN user_tenant_assignments a ON a.tenant_id = c.tenant_id AND a.status = 'active'
JOIN users u ON u.id = a.user_id
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
ORDER BY u.full_name;

-- name: ListChatMessages :many
-- A page of a channel, newest first (page.Input's cursor), with its author.
SELECT m.id, m.author_type, m.author_id, coalesce(u.full_name, '')::text AS author_name,
    coalesce(u.avatar_url, '')::text AS author_avatar, m.event_type, m.body, m.metadata, m.client_key,
    m.edited_at, m.deleted_at, m.created_at,
    m.thread_root_id AS reply_id, coalesce(ru.full_name, '')::text AS reply_author,
    coalesce(r.body, '')::text AS reply_body, (r.deleted_at IS NOT NULL)::bool AS reply_deleted,
    EXISTS (SELECT 1 FROM chat_message_photos p WHERE p.message_id = r.id)::bool AS reply_photo
FROM chat_messages m
LEFT JOIN users u ON u.id = m.author_id
LEFT JOIN chat_messages r ON r.id = m.thread_root_id
LEFT JOIN users ru ON ru.id = r.author_id
WHERE m.channel_id = @channel_id AND (m.created_at, m.id) < (@cursor_at::timestamptz, @cursor_id::uuid)
ORDER BY m.created_at DESC, m.id DESC
LIMIT @lim;

-- name: ListChatMessagesSince :many
-- What a channel gained after the phone's newest message, oldest first: a live update's fetch.
-- A message changed since then (a reaction, an edit, a delete) comes again.
SELECT m.id, m.author_type, m.author_id, coalesce(u.full_name, '')::text AS author_name,
    coalesce(u.avatar_url, '')::text AS author_avatar, m.event_type, m.body, m.metadata, m.client_key,
    m.edited_at, m.deleted_at, m.created_at,
    m.thread_root_id AS reply_id, coalesce(ru.full_name, '')::text AS reply_author,
    coalesce(r.body, '')::text AS reply_body, (r.deleted_at IS NOT NULL)::bool AS reply_deleted,
    EXISTS (SELECT 1 FROM chat_message_photos p WHERE p.message_id = r.id)::bool AS reply_photo
FROM chat_messages m
LEFT JOIN users u ON u.id = m.author_id
LEFT JOIN chat_messages r ON r.id = m.thread_root_id
LEFT JOIN users ru ON ru.id = r.author_id
WHERE m.channel_id = @channel_id AND (m.created_at > @since::timestamptz OR m.changed_at > @since::timestamptz)
ORDER BY m.created_at, m.id
LIMIT 200;

-- name: InsertChatMessage :one
-- A person's message; a repeat of the same client_key returns the first one, saved once.
-- thread_root_id is the message it replies to (shown quoted above it); metadata holds a shared screen.
INSERT INTO chat_messages (tenant_id, channel_id, author_type, author_id, body, client_key, thread_root_id, metadata)
VALUES (@tenant_id, @channel_id, 'user', @author_id, @body, @client_key, sqlc.narg(reply_to)::uuid, @metadata)
ON CONFLICT (author_id, client_key) WHERE client_key IS NOT NULL DO UPDATE SET client_key = excluded.client_key
RETURNING id, created_at;

-- name: SetChatChannelLast :exec
UPDATE chat_channels SET last_message_id = @message_id, last_message_at = @at
WHERE id = @id AND (last_message_at IS NULL OR last_message_at <= @at);

-- name: MarkChatRead :one
-- Moves how far someone has read, only ever forward; returns where it was before.
WITH before AS (
    SELECT last_read_at FROM chat_reads WHERE user_id = @user_id AND channel_id = @channel_id
)
INSERT INTO chat_reads (user_id, channel_id, last_read_at)
VALUES (@user_id, @channel_id, @at)
ON CONFLICT (user_id, channel_id) DO UPDATE
SET last_read_at = GREATEST(chat_reads.last_read_at, excluded.last_read_at), updated_at = now()
RETURNING (SELECT coalesce((SELECT last_read_at FROM before), '-infinity'::timestamptz))::timestamptz AS was;

-- name: ChatAuthorsBetween :many
-- Whose messages someone has just read: the people whose Seen by changed.
SELECT DISTINCT author_id::uuid FROM chat_messages
WHERE channel_id = @channel_id AND author_id IS NOT NULL AND author_id <> @reader_id
  AND created_at > @after::timestamptz AND created_at <= @until::timestamptz;

-- name: InsertChatPhoto :exec
INSERT INTO chat_message_photos (message_id, position, path, preview_path, width, height)
VALUES (@message_id, @position, @path, @preview_path, @width, @height);

-- name: ListChatPhotos :many
-- The photos of a page of messages, in their order.
SELECT message_id, position, path, preview_path, width, height
FROM chat_message_photos
WHERE message_id = ANY(@message_ids::uuid[])
ORDER BY message_id, position;

-- name: GetChatMessage :one
-- One message of a channel: what a reply quotes, or what is deleted.
SELECT m.id, m.channel_id, m.author_id, m.author_type, m.deleted_at, m.created_at, m.body
FROM chat_messages m
WHERE m.id = @id AND m.channel_id = @channel_id;

-- name: DeleteChatMessage :exec
-- Soft: a "deleted" line stays where it was, its text and photos no longer shown.
UPDATE chat_messages SET deleted_at = now(), changed_at = now() WHERE id = @id AND deleted_at IS NULL;

-- name: ListChatActivity :many
-- Activity, as Slack's: every message from someone else across the caller's channels, newest
-- first, without opening them; a reply to one of theirs is marked. Unread past their read mark.
SELECT m.id, m.author_type, m.author_id, coalesce(u.full_name, '')::text AS author_name,
    coalesce(u.avatar_url, '')::text AS author_avatar, m.event_type, m.body, m.metadata, m.client_key,
    m.edited_at, m.deleted_at, m.created_at,
    c.id AS channel_id, c.kind AS channel_kind, coalesce(s.name, c.name, '')::text AS channel_name,
    (m.created_at > coalesce(cr.last_read_at, '-infinity'))::bool AS unread,
    coalesce(rt.author_id = @user_id, false)::bool AS to_me,
    (position('@' || (SELECT me.full_name FROM users me WHERE me.id = @user_id) IN m.body) > 0
        OR position('@everyone' IN m.body) > 0)::bool AS mentions_me
FROM chat_messages m
JOIN chat_channels c ON c.id = m.channel_id
LEFT JOIN stores s ON s.id = c.store_id
LEFT JOIN users u ON u.id = m.author_id
LEFT JOIN chat_messages rt ON rt.id = m.thread_root_id
LEFT JOIN chat_reads cr ON cr.channel_id = c.id AND cr.user_id = @user_id
WHERE c.tenant_id = @tenant_id AND m.deleted_at IS NULL
  AND m.author_id IS DISTINCT FROM @user_id
  AND (CASE c.kind
    WHEN 'general' THEN true
    WHEN 'admin' THEN @chat_vip::bool
    WHEN 'personal' THEN c.user_id = @user_id
    WHEN 'store' THEN EXISTS (SELECT 1 FROM user_store_assignments sa WHERE sa.store_id = c.store_id AND sa.user_id = @user_id)
    WHEN 'group' THEN EXISTS (SELECT 1 FROM chat_channel_members gm WHERE gm.channel_id = c.id AND gm.user_id = @user_id)
    ELSE false
  END OR (@chat_admin::bool AND cr.followed_at IS NOT NULL AND c.kind <> 'personal'))
  AND (m.created_at, m.id) < (@cursor_at::timestamptz, @cursor_id::uuid)
ORDER BY m.created_at DESC, m.id DESC
LIMIT @lim;

-- name: CountChatActivityUnread :one
-- How many of ListChatActivity's are unread (stops at 100), for the Activity switch.
SELECT count(*)::int FROM (
    SELECT 1
    FROM chat_messages m
    JOIN chat_channels c ON c.id = m.channel_id
    LEFT JOIN chat_reads cr ON cr.channel_id = c.id AND cr.user_id = @user_id
    WHERE c.tenant_id = @tenant_id AND m.deleted_at IS NULL
      AND m.author_id IS DISTINCT FROM @user_id
      AND m.created_at > coalesce(cr.last_read_at, '-infinity')
      AND (CASE c.kind
        WHEN 'general' THEN true
        WHEN 'admin' THEN @chat_vip::bool
        WHEN 'personal' THEN c.user_id = @user_id
        WHEN 'store' THEN EXISTS (SELECT 1 FROM user_store_assignments sa WHERE sa.store_id = c.store_id AND sa.user_id = @user_id)
        WHEN 'group' THEN EXISTS (SELECT 1 FROM chat_channel_members gm WHERE gm.channel_id = c.id AND gm.user_id = @user_id)
        ELSE false
      END OR (@chat_admin::bool AND cr.followed_at IS NOT NULL AND c.kind <> 'personal'))
    LIMIT 100
) a;

-- name: EditChatMessage :exec
-- Its author's new text; edited_at shows "edited", changed_at brings it to the phones.
UPDATE chat_messages SET body = @body, edited_at = now(), changed_at = now()
WHERE id = @id AND deleted_at IS NULL;

-- name: AddChatReaction :exec
INSERT INTO chat_message_reactions (message_id, user_id, emoji) VALUES (@message_id, @user_id, @emoji)
ON CONFLICT DO NOTHING;

-- name: RemoveChatReaction :exec
DELETE FROM chat_message_reactions WHERE message_id = @message_id AND user_id = @user_id AND emoji = @emoji;

-- name: TouchChatMessage :exec
UPDATE chat_messages SET changed_at = now() WHERE id = @id;

-- name: ListChatReactions :many
-- The reactions of a page of messages: who, which, in order.
SELECT x.message_id, x.emoji, x.user_id, coalesce(u.full_name, '')::text AS name
FROM chat_message_reactions x
LEFT JOIN users u ON u.id = x.user_id
WHERE x.message_id = ANY(@message_ids::uuid[])
ORDER BY x.message_id, x.created_at;

-- name: CreateChatGroup :one
INSERT INTO chat_channels (tenant_id, kind, name, created_by)
VALUES (@tenant_id, 'group', @name, @created_by)
RETURNING id;

-- name: UpdateChatGroup :one
-- Renames a group, or archives it (read only, history kept) and back; a nil leaves it as it is.
UPDATE chat_channels SET
    name = coalesce(sqlc.narg(name)::text, name),
    archived_at = CASE
        WHEN sqlc.narg(archived)::bool IS NULL THEN archived_at
        WHEN sqlc.narg(archived)::bool THEN coalesce(archived_at, now())
    END
WHERE id = @id AND tenant_id = @tenant_id AND kind = 'group'
RETURNING id;

-- name: SetChatGroupMembers :exec
-- A group's people, the whole list: whoever is not in it leaves, only the tenant's active people join.
WITH keep AS (SELECT unnest(@user_ids::uuid[]) AS user_id),
gone AS (
    DELETE FROM chat_channel_members g
    WHERE g.channel_id = @channel_id AND g.user_id NOT IN (SELECT user_id FROM keep)
)
INSERT INTO chat_channel_members (channel_id, user_id, added_by)
SELECT @channel_id, k.user_id, @added_by
FROM keep k
JOIN user_tenant_assignments a ON a.user_id = k.user_id AND a.tenant_id = @tenant_id AND a.status = 'active'
ON CONFLICT DO NOTHING;

-- name: ListChatPeople :many
-- Everyone in the tenant with a chat level (the owner always): who a group can be made of.
SELECT u.id, u.full_name, coalesce(u.avatar_url, '')::text AS avatar_url
FROM user_tenant_assignments a
JOIN tenants t ON t.id = a.tenant_id
JOIN users u ON u.id = a.user_id
LEFT JOIN user_app_access x ON x.tenant_id = a.tenant_id AND x.user_id = a.user_id AND x.app = 'chat'
WHERE a.tenant_id = @tenant_id AND a.status = 'active' AND (t.owner_id = a.user_id OR x.access IS NOT NULL)
ORDER BY u.full_name;

-- name: ListChatGroupMembers :many
SELECT user_id FROM chat_channel_members WHERE channel_id = @channel_id;

-- name: SetChatFollow :exec
-- A chat admin follows a channel (or stops): its badge counts from now, not its whole history.
INSERT INTO chat_reads (user_id, channel_id, last_read_at, followed_at)
VALUES (@user_id, @channel_id, now(), CASE WHEN @follow::bool THEN now() END)
ON CONFLICT (user_id, channel_id) DO UPDATE
SET followed_at = CASE WHEN @follow::bool THEN coalesce(chat_reads.followed_at, now()) END, updated_at = now();

-- name: ListUserChatGroups :many
-- UAC: every group of the tenant, and whether this person is in it.
SELECT c.id, coalesce(c.name, '')::text AS name, (c.archived_at IS NOT NULL)::bool AS archived,
    EXISTS (SELECT 1 FROM chat_channel_members g WHERE g.channel_id = c.id AND g.user_id = @user_id)::bool AS member
FROM chat_channels c
WHERE c.tenant_id = @tenant_id AND c.kind = 'group'
ORDER BY c.archived_at IS NOT NULL, lower(c.name);

-- name: SetUserChatGroups :exec
-- UAC: the groups this person is in, the whole list; the same rows a group's own screen writes.
WITH want AS (SELECT unnest(@channel_ids::uuid[]) AS id),
gone AS (
    DELETE FROM chat_channel_members g
    USING chat_channels c
    WHERE c.id = g.channel_id AND c.tenant_id = @tenant_id AND c.kind = 'group'
      AND g.user_id = @user_id AND g.channel_id NOT IN (SELECT id FROM want)
)
INSERT INTO chat_channel_members (channel_id, user_id, added_by)
SELECT c.id, @user_id, @added_by
FROM chat_channels c
JOIN want w ON w.id = c.id
WHERE c.tenant_id = @tenant_id AND c.kind = 'group'
ON CONFLICT DO NOTHING;
