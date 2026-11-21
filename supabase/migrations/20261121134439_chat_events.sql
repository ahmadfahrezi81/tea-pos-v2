-- What chat says by itself (Step 74). Additive only: one nullable column and its index.
-- An event's key (a day, a payout, a release) is posted once per channel, however often its job runs.
ALTER TABLE public.chat_messages ADD COLUMN event_key text;
CREATE UNIQUE INDEX chat_messages_event_key ON public.chat_messages (channel_id, event_key) WHERE event_key IS NOT NULL;
