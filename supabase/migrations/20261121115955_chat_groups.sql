-- Chat groups and Follow (task 070). Adds only: v1 never reads these.

-- A group's people: the one kind of channel whose membership is stored (RFC: Chat (v2)).
CREATE TABLE IF NOT EXISTS public.chat_channel_members (
    channel_id uuid NOT NULL REFERENCES public.chat_channels (id),
    user_id uuid NOT NULL REFERENCES public.users (id),
    added_by uuid REFERENCES public.users (id),
    added_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX IF NOT EXISTS chat_channel_members_user ON public.chat_channel_members (user_id);
-- Go is the only way in: v1's browser carries the Supabase key.
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;

-- An archived group is read only, its history kept.
ALTER TABLE public.chat_channels ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- A chat admin following a channel they are not in: its badge and pushes. Its own column,
-- since opening a channel already writes a read mark.
ALTER TABLE public.chat_reads ADD COLUMN IF NOT EXISTS followed_at timestamptz;
