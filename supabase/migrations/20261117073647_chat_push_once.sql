-- Each chat message is pushed once (task 068c): a push job claims the channel's newest message
-- here before sending, so two jobs for the same burst never send it twice. Adds only.
ALTER TABLE public.chat_channels ADD COLUMN IF NOT EXISTS last_pushed_message_id uuid;
