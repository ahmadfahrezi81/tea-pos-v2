-- name: Notify :exec
-- Tells the realtime hub a change was saved (internal/realtime). Inside a transaction it is
-- delivered only if the transaction commits.
SELECT pg_notify('changes', @message::text);
