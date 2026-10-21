--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: payroll_claims_month_key(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payroll_claims_month_key(d date) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$ SELECT to_char(d, 'YYYY-MM') $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: store_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    store_id uuid NOT NULL,
    daily_summary_id uuid NOT NULL,
    user_id uuid NOT NULL,
    claim_code character varying(6) NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    previous_session_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT store_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'ended'::text])))
);


--
-- Name: transfer_store_session(uuid, uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transfer_store_session(p_tenant_id uuid, p_store_id uuid, p_user_id uuid, p_claim_code text, p_new_claim_code text) RETURNS public.store_sessions
    LANGUAGE plpgsql
    SET search_path TO 'public'
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


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: user_tenant_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_tenant_ids() RETURNS uuid[]
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT ARRAY(
    SELECT tenant_id
    FROM user_tenant_assignments
    WHERE user_id = auth.uid()
  );
$$;


--
-- Name: payroll_claim_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_claim_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    frequency text NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    amount integer DEFAULT 0 NOT NULL,
    claim_source text DEFAULT 'manual'::text NOT NULL,
    auto_threshold_hours numeric,
    CONSTRAINT payroll_claim_configs_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'one_time'::text]))),
    CONSTRAINT payroll_claim_types_auto_threshold_check CHECK (((claim_source <> 'auto'::text) OR (auto_threshold_hours IS NOT NULL))),
    CONSTRAINT payroll_claim_types_claim_source_check CHECK ((claim_source = ANY (ARRAY['manual'::text, 'auto'::text, 'auto_submit'::text])))
);


--
-- Name: payroll_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    store_id uuid,
    amount numeric(12,2) NOT NULL,
    date date NOT NULL,
    notes text,
    photo_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    claim_config_id uuid,
    frequency text,
    daily_summary_id uuid,
    hours_worked numeric,
    payout_id uuid,
    CONSTRAINT payroll_claims_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT reimbursements_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: payroll_commission_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_commission_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    rate_per_cup integer DEFAULT 0 NOT NULL
);


--
-- Name: payroll_commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_commissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    store_id uuid NOT NULL,
    user_id uuid NOT NULL,
    daily_summary_id uuid NOT NULL,
    date date NOT NULL,
    total_cups integer DEFAULT 0 NOT NULL,
    rate_per_cup numeric NOT NULL,
    total_commission numeric NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    commission_config_id uuid,
    payout_id uuid,
    total_orders integer DEFAULT 0 NOT NULL,
    CONSTRAINT payroll_commissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: payroll_payouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    commissions_total numeric(12,2) DEFAULT 0 NOT NULL,
    claims_total numeric(12,2) DEFAULT 0 NOT NULL,
    total_pay numeric(12,2) DEFAULT 0 NOT NULL,
    payment_proof_url text,
    paid_at timestamp with time zone,
    paid_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_cups integer DEFAULT 0 NOT NULL,
    total_orders integer DEFAULT 0 NOT NULL,
    notes text,
    CONSTRAINT payroll_payouts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'skipped'::text])))
);


--
-- Name: COLUMN payroll_payouts.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payroll_payouts.notes IS 'Free-text context recorded by the admin when confirming payment.';


--
-- Name: payroll_user_claim_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_user_claim_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    claim_config_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payroll_user_info; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_user_info (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    commission_config_id uuid,
    bank_name text,
    bank_account_number text,
    bank_account_holder text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: store_daily_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_daily_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    opened_by uuid NOT NULL,
    date date NOT NULL,
    opening_balance integer DEFAULT 0 NOT NULL,
    total_sales integer DEFAULT 0 NOT NULL,
    expected_cash integer DEFAULT 0 NOT NULL,
    actual_cash integer,
    variance integer,
    closed_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id uuid,
    total_orders integer DEFAULT 0 NOT NULL,
    total_cups integer DEFAULT 0 NOT NULL,
    total_expenses numeric DEFAULT 0 NOT NULL,
    opening_cash_breakdown jsonb,
    closing_cash_breakdown jsonb,
    closed_by uuid
);


--
-- Name: store_daily_summary_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_daily_summary_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    daily_summary_id uuid,
    expense_id uuid,
    store_id uuid NOT NULL,
    tenant_id uuid,
    type text NOT NULL,
    url text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    quantity jsonb,
    CONSTRAINT daily_summary_photos_type_check CHECK ((type = ANY (ARRAY['opening'::text, 'closing'::text, 'closing:ice'::text, 'closing:syrup'::text, 'closing:bags'::text, 'closing:cups'::text, 'closing:tea'::text, 'expense'::text])))
);


--
-- Name: store_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    daily_summary_id uuid NOT NULL,
    store_id uuid NOT NULL,
    type text NOT NULL,
    amount integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    user_id uuid,
    photo_url text,
    notes text
);


--
-- Name: store_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    product_id uuid,
    quantity integer NOT NULL,
    unit_price integer NOT NULL,
    total_price integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id uuid,
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: store_order_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_order_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    xendit_qr_id text NOT NULL,
    xendit_reference_id text NOT NULL,
    qr_string text NOT NULL,
    amount numeric(12,2) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    store_id uuid NOT NULL,
    tenant_id uuid,
    user_id uuid NOT NULL,
    order_id uuid,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    pending_items jsonb,
    CONSTRAINT payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'expired'::text, 'failed'::text])))
);


--
-- Name: store_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    user_id uuid NOT NULL,
    total_amount integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id uuid,
    payment_method text DEFAULT 'cash'::text NOT NULL,
    daily_summary_id uuid,
    CONSTRAINT orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'qris'::text])))
);


--
-- Name: store_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    store_id uuid NOT NULL,
    user_id uuid NOT NULL,
    daily_summary_id uuid,
    type text NOT NULL,
    notes text NOT NULL,
    photo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: store_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    store_id uuid NOT NULL,
    user_id uuid NOT NULL,
    daily_summary_id uuid,
    type text NOT NULL,
    notes text,
    photo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tenant_id uuid,
    latitude double precision,
    longitude double precision,
    status text DEFAULT 'active'::text NOT NULL,
    open_time text DEFAULT '08:00'::text NOT NULL,
    close_time text DEFAULT '22:00'::text NOT NULL,
    CONSTRAINT stores_status_check CHECK ((status = ANY (ARRAY['active'::text, 'fake'::text, 'inactive'::text])))
);


--
-- Name: tenant_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    store_id uuid,
    type text NOT NULL,
    ref_id uuid,
    ref_table text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    daily_summary_id uuid
);


--
-- Name: tenant_customer_feedbacks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_customer_feedbacks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    location_name text NOT NULL,
    location_display text NOT NULL,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenant_product_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_product_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tenant_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    price integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    image_url text,
    tenant_id uuid,
    status text DEFAULT 'draft'::text,
    category_id uuid,
    image_path text,
    popularity_rank integer,
    CONSTRAINT chk_products_status CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'out of stock'::text, 'archive'::text, 'draft'::text])))
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    slug text NOT NULL,
    pay_frequency text DEFAULT 'bi_weekly'::text NOT NULL,
    CONSTRAINT tenants_pay_frequency_check CHECK ((pay_frequency = ANY (ARRAY['weekly'::text, 'bi_weekly'::text, 'four_weekly'::text])))
);


--
-- Name: user_store_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_store_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    store_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    is_default boolean DEFAULT false NOT NULL
);


--
-- Name: user_tenant_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_tenant_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    role text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    phone_number character varying(20),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    preferred_language text DEFAULT 'en'::text NOT NULL,
    avatar_url text,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['USER'::text, 'ADMIN'::text, 'DRIVER'::text, 'SUPPLIER'::text]))),
    CONSTRAINT profiles_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('pending'::character varying)::text, ('suspended'::character varying)::text])))
);


--
-- Name: COLUMN users.phone_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.phone_number IS 'User phone number with country code (e.g., +1234567890)';


--
-- Name: COLUMN users.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.status IS 'User account status: active, inactive, pending, or suspended';


--
-- Name: weather_hourly; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weather_hourly (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    hour smallint NOT NULL,
    temperature numeric NOT NULL,
    precipitation_probability numeric NOT NULL,
    weather_code integer NOT NULL,
    lat numeric NOT NULL,
    lng numeric NOT NULL,
    city text NOT NULL,
    region text NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT weather_hourly_hour_check CHECK (((hour >= 0) AND (hour <= 23)))
);


--
-- Name: tenant_activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: tenant_customer_feedbacks customer_feedbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_customer_feedbacks
    ADD CONSTRAINT customer_feedbacks_pkey PRIMARY KEY (id);


--
-- Name: store_daily_summaries daily_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_daily_summaries
    ADD CONSTRAINT daily_summaries_pkey PRIMARY KEY (id);


--
-- Name: store_daily_summaries daily_summaries_store_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_daily_summaries
    ADD CONSTRAINT daily_summaries_store_id_date_key UNIQUE (store_id, date);


--
-- Name: store_daily_summary_photos daily_summary_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_daily_summary_photos
    ADD CONSTRAINT daily_summary_photos_pkey PRIMARY KEY (id);


--
-- Name: store_expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: store_reports incident_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_reports
    ADD CONSTRAINT incident_reports_pkey PRIMARY KEY (id);


--
-- Name: store_order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: store_orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: store_order_payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_order_payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: store_order_payments payments_xendit_qr_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_order_payments
    ADD CONSTRAINT payments_xendit_qr_id_key UNIQUE (xendit_qr_id);


--
-- Name: store_order_payments payments_xendit_reference_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_order_payments
    ADD CONSTRAINT payments_xendit_reference_id_key UNIQUE (xendit_reference_id);


--
-- Name: payroll_user_claim_assignments payroll_claim_eligibility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_user_claim_assignments
    ADD CONSTRAINT payroll_claim_eligibility_pkey PRIMARY KEY (id);


--
-- Name: payroll_user_claim_assignments payroll_claim_eligibility_tenant_id_user_id_claim_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_user_claim_assignments
    ADD CONSTRAINT payroll_claim_eligibility_tenant_id_user_id_claim_type_id_key UNIQUE (tenant_id, user_id, claim_config_id);


--
-- Name: payroll_claim_configs payroll_claim_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_claim_configs
    ADD CONSTRAINT payroll_claim_types_pkey PRIMARY KEY (id);


--
-- Name: payroll_claim_configs payroll_claim_types_tenant_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_claim_configs
    ADD CONSTRAINT payroll_claim_types_tenant_id_slug_key UNIQUE (tenant_id, slug);


--
-- Name: payroll_commission_configs payroll_commission_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_commission_configs
    ADD CONSTRAINT payroll_commission_types_pkey PRIMARY KEY (id);


--
-- Name: payroll_commission_configs payroll_commission_types_tenant_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_commission_configs
    ADD CONSTRAINT payroll_commission_types_tenant_id_slug_key UNIQUE (tenant_id, slug);


--
-- Name: payroll_commissions payroll_commissions_daily_summary_user_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_commissions
    ADD CONSTRAINT payroll_commissions_daily_summary_user_key UNIQUE (tenant_id, user_id, daily_summary_id);


--
-- Name: payroll_commissions payroll_entries_daily_summary_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_commissions
    ADD CONSTRAINT payroll_entries_daily_summary_id_user_id_key UNIQUE (daily_summary_id, user_id);


--
-- Name: payroll_commissions payroll_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_commissions
    ADD CONSTRAINT payroll_entries_pkey PRIMARY KEY (id);


--
-- Name: payroll_payouts payroll_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_payouts
    ADD CONSTRAINT payroll_payouts_pkey PRIMARY KEY (id);


--
-- Name: payroll_payouts payroll_payouts_tenant_user_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_payouts
    ADD CONSTRAINT payroll_payouts_tenant_user_start_key UNIQUE (tenant_id, user_id, start_date);


--
-- Name: payroll_user_info payroll_user_info_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_user_info
    ADD CONSTRAINT payroll_user_info_pkey PRIMARY KEY (id);


--
-- Name: payroll_user_info payroll_user_info_tenant_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_user_info
    ADD CONSTRAINT payroll_user_info_tenant_id_user_id_key UNIQUE (tenant_id, user_id);


--
-- Name: tenant_product_categories product_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_product_categories
    ADD CONSTRAINT product_categories_pkey PRIMARY KEY (id);


--
-- Name: tenant_product_categories product_categories_tenant_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_product_categories
    ADD CONSTRAINT product_categories_tenant_id_slug_key UNIQUE (tenant_id, slug);


--
-- Name: tenant_products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: users profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: payroll_claims reimbursements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_claims
    ADD CONSTRAINT reimbursements_pkey PRIMARY KEY (id);


--
-- Name: store_sessions store_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_sessions
    ADD CONSTRAINT store_sessions_pkey PRIMARY KEY (id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: store_requests supply_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_requests
    ADD CONSTRAINT supply_requests_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: user_store_assignments user_store_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_store_assignments
    ADD CONSTRAINT user_store_assignments_pkey PRIMARY KEY (id);


--
-- Name: user_store_assignments user_store_assignments_user_store_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_store_assignments
    ADD CONSTRAINT user_store_assignments_user_store_unique UNIQUE (user_id, store_id);


--
-- Name: user_tenant_assignments user_tenant_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tenant_assignments
    ADD CONSTRAINT user_tenant_assignments_pkey PRIMARY KEY (id);


--
-- Name: user_tenant_assignments user_tenant_assignments_tenant_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tenant_assignments
    ADD CONSTRAINT user_tenant_assignments_tenant_id_user_id_key UNIQUE (tenant_id, user_id);


--
-- Name: weather_hourly weather_hourly_date_hour_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weather_hourly
    ADD CONSTRAINT weather_hourly_date_hour_key UNIQUE (date, hour);


--
-- Name: weather_hourly weather_hourly_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weather_hourly
    ADD CONSTRAINT weather_hourly_pkey PRIMARY KEY (id);


--
-- Name: activity_logs_store_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_logs_store_id_created_at_idx ON public.tenant_activity_logs USING btree (store_id, created_at DESC);


--
-- Name: activity_logs_tenant_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_logs_tenant_id_created_at_idx ON public.tenant_activity_logs USING btree (tenant_id, created_at DESC);


--
-- Name: activity_logs_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_logs_type_idx ON public.tenant_activity_logs USING btree (type);


--
-- Name: activity_logs_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_logs_user_id_created_at_idx ON public.tenant_activity_logs USING btree (user_id, created_at DESC);


--
-- Name: customer_feedbacks_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_feedbacks_created_at_idx ON public.tenant_customer_feedbacks USING btree (created_at DESC);


--
-- Name: customer_feedbacks_seller_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_feedbacks_seller_id_idx ON public.tenant_customer_feedbacks USING btree (user_id);


--
-- Name: customer_feedbacks_tenant_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_feedbacks_tenant_id_idx ON public.tenant_customer_feedbacks USING btree (tenant_id);


--
-- Name: idx_daily_summary_photos_expense_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_summary_photos_expense_id ON public.store_daily_summary_photos USING btree (expense_id);


--
-- Name: idx_daily_summary_photos_summary_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_summary_photos_summary_id ON public.store_daily_summary_photos USING btree (daily_summary_id);


--
-- Name: idx_payments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_order_id ON public.store_order_payments USING btree (order_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.store_order_payments USING btree (status);


--
-- Name: idx_payments_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_store_id ON public.store_order_payments USING btree (store_id);


--
-- Name: idx_payments_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_tenant_id ON public.store_order_payments USING btree (tenant_id);


--
-- Name: idx_payments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_user_id ON public.store_order_payments USING btree (user_id);


--
-- Name: idx_product_categories_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_categories_tenant_id ON public.tenant_product_categories USING btree (tenant_id);


--
-- Name: idx_products_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category_id ON public.tenant_products USING btree (category_id);


--
-- Name: idx_products_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_status ON public.tenant_products USING btree (status);


--
-- Name: idx_products_tenant_popularity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_tenant_popularity ON public.tenant_products USING btree (tenant_id, popularity_rank);


--
-- Name: idx_profiles_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_status ON public.users USING btree (status);


--
-- Name: idx_tenants_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_slug ON public.tenants USING btree (slug);


--
-- Name: one_active_session_per_store; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_active_session_per_store ON public.store_sessions USING btree (store_id) WHERE (status = 'active'::text);


--
-- Name: one_default_store_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_default_store_per_user ON public.user_store_assignments USING btree (user_id) WHERE (is_default = true);


--
-- Name: payroll_claims_auto_daily_summary_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payroll_claims_auto_daily_summary_unique ON public.payroll_claims USING btree (daily_summary_id, user_id, claim_config_id) WHERE (daily_summary_id IS NOT NULL);


--
-- Name: payroll_claims_daily_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payroll_claims_daily_unique ON public.payroll_claims USING btree (tenant_id, user_id, claim_config_id, date) WHERE ((status <> 'rejected'::text) AND (frequency = 'daily'::text));


--
-- Name: payroll_claims_monthly_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payroll_claims_monthly_unique ON public.payroll_claims USING btree (tenant_id, user_id, claim_config_id, public.payroll_claims_month_key(date)) WHERE ((status <> 'rejected'::text) AND (frequency = 'monthly'::text));


--
-- Name: payroll_claims_one_time_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payroll_claims_one_time_unique ON public.payroll_claims USING btree (tenant_id, user_id, claim_config_id) WHERE ((status <> 'rejected'::text) AND (frequency = 'one_time'::text));


--
-- Name: payroll_claims_payout_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payroll_claims_payout_id_idx ON public.payroll_claims USING btree (payout_id) WHERE (payout_id IS NOT NULL);


--
-- Name: payroll_claims_weekly_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payroll_claims_weekly_unique ON public.payroll_claims USING btree (tenant_id, user_id, claim_config_id, ((date - ((EXTRACT(isodow FROM date))::integer - 1)))) WHERE ((status <> 'rejected'::text) AND (frequency = 'weekly'::text));


--
-- Name: payroll_commissions_payout_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payroll_commissions_payout_id_idx ON public.payroll_commissions USING btree (payout_id) WHERE (payout_id IS NOT NULL);


--
-- Name: store_order_items_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_order_items_order_id_idx ON public.store_order_items USING btree (order_id);


--
-- Name: store_orders_daily_summary_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_orders_daily_summary_id_idx ON public.store_orders USING btree (daily_summary_id);


--
-- Name: store_orders_store_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_orders_store_id_created_at_idx ON public.store_orders USING btree (store_id, created_at DESC);


--
-- Name: store_sessions_tenant_id_user_id_started_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_sessions_tenant_id_user_id_started_at_idx ON public.store_sessions USING btree (tenant_id, user_id, started_at);


--
-- Name: tenant_activity_logs_tenant_summary_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_activity_logs_tenant_summary_idx ON public.tenant_activity_logs USING btree (tenant_id, daily_summary_id);


--
-- Name: unique_daily_summary_store_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_daily_summary_store_date ON public.store_daily_summaries USING btree (store_id, date, tenant_id);


--
-- Name: store_order_payments payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.store_order_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_activity_logs activity_logs_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_activity_logs
    ADD CONSTRAINT activity_logs_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;


--
-- Name: tenant_activity_logs activity_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_activity_logs
    ADD CONSTRAINT activity_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tenant_customer_feedbacks customer_feedbacks_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_customer_feedbacks
    ADD CONSTRAINT customer_feedbacks_seller_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tenant_customer_feedbacks customer_feedbacks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_customer_feedbacks
    ADD CONSTRAINT customer_feedbacks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: store_daily_summaries daily_summaries_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_daily_summaries
    ADD CONSTRAINT daily_summaries_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id);


--
-- Name: store_daily_summaries daily_summaries_opened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_daily_summaries
    ADD CONSTRAINT daily_summaries_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES public.users(id);


--
-- Name: store_daily_summaries daily_summaries_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_daily_summaries
    ADD CONSTRAINT daily_summaries_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: store_daily_summaries daily_summaries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_daily_summaries
    ADD CONSTRAINT daily_summaries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: store_daily_summary_photos daily_summary_photos_daily_summary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_daily_summary_photos
    ADD CONSTRAINT daily_summary_photos_daily_summary_id_fkey FOREIGN KEY (daily_summary_id) REFERENCES public.store_daily_summaries(id) ON DELETE CASCADE;


--
-- Name: store_daily_summary_photos daily_summary_photos_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_daily_summary_photos
    ADD CONSTRAINT daily_summary_photos_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.store_expenses(id) ON DELETE CASCADE;


--
-- Name: store_daily_summary_photos daily_summary_photos_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_daily_summary_photos
    ADD CONSTRAINT daily_summary_photos_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: store_daily_summary_photos daily_summary_photos_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_daily_summary_photos
    ADD CONSTRAINT daily_summary_photos_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: store_expenses expenses_daily_summary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_expenses
    ADD CONSTRAINT expenses_daily_summary_id_fkey FOREIGN KEY (daily_summary_id) REFERENCES public.store_daily_summaries(id) ON DELETE CASCADE;


--
-- Name: store_expenses expenses_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_expenses
    ADD CONSTRAINT expenses_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: store_expenses expenses_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_expenses
    ADD CONSTRAINT expenses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: store_expenses expenses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_expenses
    ADD CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tenant_products fk_products_category_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_products
    ADD CONSTRAINT fk_products_category_id FOREIGN KEY (category_id) REFERENCES public.tenant_product_categories(id) ON DELETE SET NULL;


--
-- Name: store_reports incident_reports_daily_summary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_reports
    ADD CONSTRAINT incident_reports_daily_summary_id_fkey FOREIGN KEY (daily_summary_id) REFERENCES public.store_daily_summaries(id);


--
-- Name: store_reports incident_reports_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_reports
    ADD CONSTRAINT incident_reports_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: store_reports incident_reports_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_reports
    ADD CONSTRAINT incident_reports_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: store_reports incident_reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_reports
    ADD CONSTRAINT incident_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: store_order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.store_orders(id) ON DELETE CASCADE;


--
-- Name: store_order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.tenant_products(id);


--
-- Name: store_order_items order_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_order_items
    ADD CONSTRAINT order_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: store_orders orders_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_orders
    ADD CONSTRAINT orders_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: store_orders orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_orders
    ADD CONSTRAINT orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: store_orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: store_order_payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_order_payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.store_orders(id);


--
-- Name: store_order_payments payments_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_order_payments
    ADD CONSTRAINT payments_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: store_order_payments payments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_order_payments
    ADD CONSTRAINT payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: store_order_payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_order_payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: payroll_user_claim_assignments payroll_claim_eligibility_claim_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_user_claim_assignments
    ADD CONSTRAINT payroll_claim_eligibility_claim_type_id_fkey FOREIGN KEY (claim_config_id) REFERENCES public.payroll_claim_configs(id);


--
-- Name: payroll_user_claim_assignments payroll_claim_eligibility_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_user_claim_assignments
    ADD CONSTRAINT payroll_claim_eligibility_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payroll_user_claim_assignments payroll_claim_eligibility_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_user_claim_assignments
    ADD CONSTRAINT payroll_claim_eligibility_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: payroll_claim_configs payroll_claim_types_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_claim_configs
    ADD CONSTRAINT payroll_claim_types_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payroll_claims payroll_claims_claim_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_claims
    ADD CONSTRAINT payroll_claims_claim_type_id_fkey FOREIGN KEY (claim_config_id) REFERENCES public.payroll_claim_configs(id);


--
-- Name: payroll_claims payroll_claims_daily_summary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_claims
    ADD CONSTRAINT payroll_claims_daily_summary_id_fkey FOREIGN KEY (daily_summary_id) REFERENCES public.store_daily_summaries(id);


--
-- Name: payroll_claims payroll_claims_payout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_claims
    ADD CONSTRAINT payroll_claims_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES public.payroll_payouts(id) ON DELETE SET NULL;


--
-- Name: payroll_claims payroll_claims_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_claims
    ADD CONSTRAINT payroll_claims_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: payroll_claims payroll_claims_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_claims
    ADD CONSTRAINT payroll_claims_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payroll_claims payroll_claims_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_claims
    ADD CONSTRAINT payroll_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: payroll_commission_configs payroll_commission_types_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_commission_configs
    ADD CONSTRAINT payroll_commission_types_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payroll_commissions payroll_commissions_commission_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_commissions
    ADD CONSTRAINT payroll_commissions_commission_type_id_fkey FOREIGN KEY (commission_config_id) REFERENCES public.payroll_commission_configs(id);


--
-- Name: payroll_commissions payroll_commissions_daily_summary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_commissions
    ADD CONSTRAINT payroll_commissions_daily_summary_id_fkey FOREIGN KEY (daily_summary_id) REFERENCES public.store_daily_summaries(id);


--
-- Name: payroll_commissions payroll_commissions_payout_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_commissions
    ADD CONSTRAINT payroll_commissions_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES public.payroll_payouts(id) ON DELETE SET NULL;


--
-- Name: payroll_commissions payroll_commissions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_commissions
    ADD CONSTRAINT payroll_commissions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: payroll_commissions payroll_commissions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_commissions
    ADD CONSTRAINT payroll_commissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payroll_commissions payroll_commissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_commissions
    ADD CONSTRAINT payroll_commissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: payroll_payouts payroll_payouts_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_payouts
    ADD CONSTRAINT payroll_payouts_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.users(id);


--
-- Name: payroll_payouts payroll_payouts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_payouts
    ADD CONSTRAINT payroll_payouts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payroll_payouts payroll_payouts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_payouts
    ADD CONSTRAINT payroll_payouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: payroll_user_info payroll_user_info_commission_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_user_info
    ADD CONSTRAINT payroll_user_info_commission_type_id_fkey FOREIGN KEY (commission_config_id) REFERENCES public.payroll_commission_configs(id);


--
-- Name: payroll_user_info payroll_user_info_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_user_info
    ADD CONSTRAINT payroll_user_info_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payroll_user_info payroll_user_info_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_user_info
    ADD CONSTRAINT payroll_user_info_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tenant_product_categories product_categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_product_categories
    ADD CONSTRAINT product_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_products products_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_products
    ADD CONSTRAINT products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: users profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);


--
-- Name: store_orders store_orders_daily_summary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_orders
    ADD CONSTRAINT store_orders_daily_summary_id_fkey FOREIGN KEY (daily_summary_id) REFERENCES public.store_daily_summaries(id);


--
-- Name: store_sessions store_sessions_daily_summary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_sessions
    ADD CONSTRAINT store_sessions_daily_summary_id_fkey FOREIGN KEY (daily_summary_id) REFERENCES public.store_daily_summaries(id);


--
-- Name: store_sessions store_sessions_previous_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_sessions
    ADD CONSTRAINT store_sessions_previous_session_id_fkey FOREIGN KEY (previous_session_id) REFERENCES public.store_sessions(id);


--
-- Name: store_sessions store_sessions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_sessions
    ADD CONSTRAINT store_sessions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: store_sessions store_sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_sessions
    ADD CONSTRAINT store_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: store_sessions store_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_sessions
    ADD CONSTRAINT store_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: stores stores_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: store_requests supply_requests_daily_summary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_requests
    ADD CONSTRAINT supply_requests_daily_summary_id_fkey FOREIGN KEY (daily_summary_id) REFERENCES public.store_daily_summaries(id);


--
-- Name: store_requests supply_requests_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_requests
    ADD CONSTRAINT supply_requests_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: store_requests supply_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_requests
    ADD CONSTRAINT supply_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: store_requests supply_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_requests
    ADD CONSTRAINT supply_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tenant_activity_logs tenant_activity_logs_daily_summary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_activity_logs
    ADD CONSTRAINT tenant_activity_logs_daily_summary_id_fkey FOREIGN KEY (daily_summary_id) REFERENCES public.store_daily_summaries(id) ON DELETE SET NULL;


--
-- Name: user_store_assignments user_store_assignments_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_store_assignments
    ADD CONSTRAINT user_store_assignments_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: user_store_assignments user_store_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_store_assignments
    ADD CONSTRAINT user_store_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_tenant_assignments user_tenant_assignments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tenant_assignments
    ADD CONSTRAINT user_tenant_assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: user_tenant_assignments user_tenant_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tenant_assignments
    ADD CONSTRAINT user_tenant_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payroll_commissions Authenticated users can access payroll_entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access payroll_entries" ON public.payroll_commissions TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: store_sessions Authenticated users can access store_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can access store_sessions" ON public.store_sessions TO authenticated USING ((auth.uid() IS NOT NULL));


--
-- Name: payroll_user_info admins can manage all payroll info in tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins can manage all payroll info in tenant" ON public.payroll_user_info USING (((tenant_id = ANY (public.user_tenant_ids())) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'ADMIN'::text)))))) WITH CHECK (((tenant_id = ANY (public.user_tenant_ids())) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'ADMIN'::text))))));


--
-- Name: payroll_claim_configs admins can manage claim types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins can manage claim types" ON public.payroll_claim_configs USING (((tenant_id = ANY (public.user_tenant_ids())) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'ADMIN'::text)))))) WITH CHECK (((tenant_id = ANY (public.user_tenant_ids())) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'ADMIN'::text))))));


--
-- Name: payroll_commission_configs admins can manage commission types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins can manage commission types" ON public.payroll_commission_configs USING (((tenant_id = ANY (public.user_tenant_ids())) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'ADMIN'::text)))))) WITH CHECK (((tenant_id = ANY (public.user_tenant_ids())) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'ADMIN'::text))))));


--
-- Name: payroll_user_claim_assignments admins can manage eligibility; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admins can manage eligibility" ON public.payroll_user_claim_assignments USING (((tenant_id = ANY (public.user_tenant_ids())) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'ADMIN'::text)))))) WITH CHECK (((tenant_id = ANY (public.user_tenant_ids())) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'ADMIN'::text))))));


--
-- Name: tenant_activity_logs authenticated users can insert activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can insert activity logs" ON public.tenant_activity_logs FOR INSERT TO authenticated WITH CHECK ((tenant_id IN ( SELECT user_tenant_assignments.tenant_id
   FROM public.user_tenant_assignments
  WHERE (user_tenant_assignments.user_id = auth.uid()))));


--
-- Name: tenant_customer_feedbacks customer_feedbacks: tenant insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer_feedbacks: tenant insert" ON public.tenant_customer_feedbacks FOR INSERT WITH CHECK ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: tenant_customer_feedbacks customer_feedbacks: tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "customer_feedbacks: tenant read" ON public.tenant_customer_feedbacks FOR SELECT USING ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: store_daily_summaries daily_summaries: tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "daily_summaries: tenant read" ON public.store_daily_summaries FOR SELECT USING ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: store_daily_summary_photos daily_summary_photos: tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "daily_summary_photos: tenant read" ON public.store_daily_summary_photos FOR SELECT USING ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: store_expenses expenses: tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "expenses: tenant read" ON public.store_expenses FOR SELECT USING ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: store_order_items order_items: tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "order_items: tenant read" ON public.store_order_items FOR SELECT USING ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: store_orders orders: tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "orders: tenant read" ON public.store_orders FOR SELECT USING ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: payroll_claims own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY own_read ON public.payroll_claims FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: payroll_payouts own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY own_read ON public.payroll_payouts FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: store_order_payments payments: service role update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payments: service role update" ON public.store_order_payments FOR UPDATE USING (true);


--
-- Name: store_order_payments payments: tenant insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payments: tenant insert" ON public.store_order_payments FOR INSERT WITH CHECK ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: store_order_payments payments: tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "payments: tenant read" ON public.store_order_payments FOR SELECT USING ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: payroll_claim_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_claim_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_commission_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_commission_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_commissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_commissions ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_payouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_payouts ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_user_claim_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_user_claim_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_user_info; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_user_info ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_product_categories product_categories: tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "product_categories: tenant read" ON public.tenant_product_categories FOR SELECT USING ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: tenant_products products: tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "products: tenant read" ON public.tenant_products FOR SELECT USING ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: users profiles: read own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles: read own" ON public.users FOR SELECT USING ((id = auth.uid()));


--
-- Name: users profiles: update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "profiles: update own" ON public.users FOR UPDATE USING ((id = auth.uid()));


--
-- Name: store_daily_summaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_daily_summaries ENABLE ROW LEVEL SECURITY;

--
-- Name: store_daily_summary_photos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_daily_summary_photos ENABLE ROW LEVEL SECURITY;

--
-- Name: store_expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: store_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: store_order_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_order_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: store_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: store_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: store_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: store_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: stores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

--
-- Name: stores stores: tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "stores: tenant read" ON public.stores FOR SELECT USING ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: tenant_activity_logs tenant members can read activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant members can read activity logs" ON public.tenant_activity_logs FOR SELECT TO authenticated USING ((tenant_id IN ( SELECT user_tenant_assignments.tenant_id
   FROM public.user_tenant_assignments
  WHERE (user_tenant_assignments.user_id = auth.uid()))));


--
-- Name: payroll_commission_configs tenant members can read commission types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenant members can read commission types" ON public.payroll_commission_configs FOR SELECT USING ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: tenant_activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_customer_feedbacks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_customer_feedbacks ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_claims tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.payroll_claims FOR INSERT WITH CHECK (((tenant_id = ANY (public.user_tenant_ids())) AND (user_id = auth.uid())));


--
-- Name: store_reports tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.store_reports FOR INSERT WITH CHECK ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: store_requests tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_insert ON public.store_requests FOR INSERT WITH CHECK ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: tenant_product_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_product_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_products ENABLE ROW LEVEL SECURITY;

--
-- Name: store_reports tenant_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_read ON public.store_reports FOR SELECT USING ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: store_requests tenant_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_read ON public.store_requests FOR SELECT USING ((tenant_id = ANY (public.user_tenant_ids())));


--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants tenants: tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tenants: tenant read" ON public.tenants FOR SELECT USING ((id = ANY (public.user_tenant_ids())));


--
-- Name: user_store_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_store_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: user_store_assignments user_store_assignments: tenant read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_store_assignments: tenant read" ON public.user_store_assignments FOR SELECT USING ((store_id IN ( SELECT stores.id
   FROM public.stores
  WHERE (stores.tenant_id = ANY (public.user_tenant_ids())))));


--
-- Name: user_tenant_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_tenant_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: user_tenant_assignments user_tenant_assignments: read own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "user_tenant_assignments: read own" ON public.user_tenant_assignments FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_user_info users can manage own payroll info; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can manage own payroll info" ON public.payroll_user_info USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: payroll_claim_configs users can read eligible claim configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can read eligible claim configs" ON public.payroll_claim_configs FOR SELECT USING (((tenant_id = ANY (public.user_tenant_ids())) AND ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'ADMIN'::text)))) OR (EXISTS ( SELECT 1
   FROM public.payroll_user_claim_assignments puca
  WHERE ((puca.claim_config_id = payroll_claim_configs.id) AND (puca.user_id = auth.uid())))))));


--
-- Name: payroll_user_claim_assignments users can read own eligibility; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can read own eligibility" ON public.payroll_user_claim_assignments FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: weather_hourly; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weather_hourly ENABLE ROW LEVEL SECURITY;

--
-- Name: weather_hourly weather_hourly: authenticated read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "weather_hourly: authenticated read" ON public.weather_hourly FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- PostgreSQL database dump complete
--


