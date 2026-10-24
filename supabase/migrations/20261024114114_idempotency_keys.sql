-- Writes saved exactly once (tea-pos v2, task 017e): each write carries an Idempotency-Key;
-- its answer is kept here, in the same transaction as the change, so a resend (a double
-- tap, a retry on slow 4G) gets the same answer without running again. Kept 24 hours.
CREATE TABLE public.idempotency_keys (
    user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    key text NOT NULL CHECK (char_length(key) BETWEEN 8 AND 100),
    -- The request it was made for: the same key with another request is refused.
    request_hash bytea NOT NULL,
    status smallint,
    content_type text,
    body bytea,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, key)
);

CREATE INDEX idempotency_keys_created_at_idx ON public.idempotency_keys (created_at);

-- Only Go's connection (which skips row-level security) reads it.
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
