-- Chat (task 068d). Adds only: v1 never reads these.

-- Which app a phone's subscription belongs to: a push goes to the app the person used last.
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS app text
    CHECK (app IN ('seller', 'backoffice'));

-- Six fixed reactions (RFC: Chat (v2)); one of each per person per message.
CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
    message_id uuid NOT NULL REFERENCES public.chat_messages (id),
    user_id uuid NOT NULL REFERENCES public.users (id),
    emoji text NOT NULL CHECK (emoji IN ('👍', '❤️', '😂', '😮', '😢', '✅')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, user_id, emoji)
);
-- Go is the only way in: v1's browser carries the Supabase key.
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

-- A message changed after it was sent (a reaction, an edit, a delete): the phone's catch-up
-- (since its newest message) fetches it again.
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS changed_at timestamptz;
