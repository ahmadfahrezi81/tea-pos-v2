-- Makes a session handover one atomic statement.
--
-- The service layer did this as select -> check code -> update -> insert across
-- separate round trips with no transaction, so two callers submitting the same
-- claim code at once both read the same active row, both passed the code check,
-- and both ended it; the second insert then died on one_active_session_per_store
-- (a 500 in prod on 2026-08-01). Worse, the update was never rolled back when
-- the insert failed, so a failure between the two left the store with no active
-- session at all and locked the seller out mid-shift.
--
-- SELECT ... FOR UPDATE serialises concurrent transfers on the session row: the
-- second caller blocks until the first commits, then re-evaluates the filter,
-- finds the row is no longer 'active', and is rejected before it can write.
--
-- The new claim code is generated in the service layer and passed in, so code
-- generation stays where the rest of the business logic lives.
--
-- Errors use PostgREST's PTxxx convention — the last three digits become the
-- HTTP status, so the API route surfaces 404/403/409 instead of a bare 500.

CREATE OR REPLACE FUNCTION public.transfer_store_session(
    p_tenant_id      uuid,
    p_store_id       uuid,
    p_user_id        uuid,
    p_claim_code     text,
    p_new_claim_code text
)
RETURNS store_sessions
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_current store_sessions;
    v_new     store_sessions;
BEGIN
    SELECT * INTO v_current
    FROM store_sessions
    WHERE store_id = p_store_id
      AND tenant_id = p_tenant_id
      AND status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Either this store never had an open session, or we just lost a race
        -- with another transfer. Distinguish them: a fresh read that finds an
        -- active session means the row we wanted was ended and replaced while
        -- we waited on the lock.
        IF EXISTS (
            SELECT 1 FROM store_sessions
            WHERE store_id = p_store_id
              AND tenant_id = p_tenant_id
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Session already transferred' USING ERRCODE = 'PT409';
        END IF;
        RAISE EXCEPTION 'No active session found' USING ERRCODE = 'PT404';
    END IF;

    IF v_current.claim_code IS DISTINCT FROM p_claim_code THEN
        RAISE EXCEPTION 'Invalid claim code' USING ERRCODE = 'PT403';
    END IF;

    UPDATE store_sessions
    SET status = 'ended', ended_at = now()
    WHERE id = v_current.id;

    INSERT INTO store_sessions (
        tenant_id, store_id, daily_summary_id, user_id, claim_code, previous_session_id
    )
    VALUES (
        p_tenant_id, p_store_id, v_current.daily_summary_id, p_user_id,
        p_new_claim_code, v_current.id
    )
    RETURNING * INTO v_new;

    RETURN v_new;
END;
$$;

-- Only the API route calls this, and it uses the service-role client.
REVOKE EXECUTE ON FUNCTION public.transfer_store_session(uuid, uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_store_session(uuid, uuid, uuid, text, text) TO service_role;
