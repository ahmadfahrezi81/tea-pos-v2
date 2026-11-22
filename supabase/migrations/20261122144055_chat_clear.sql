-- Clear chat (task 078): the owner empties a chat for everyone. Soft: every message before it is
-- hidden, nothing deleted. Additive only: one nullable column.
ALTER TABLE public.chat_channels ADD COLUMN cleared_at timestamptz;
