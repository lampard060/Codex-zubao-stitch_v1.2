--
-- PostgreSQL database dump
--

\restrict rejhPBj414isvN0hTXSaBGTY1pq689wl9f8BseBOR230Rt9hXPVwaLuS2ev8gCj

-- Dumped from database version 17.9 (Homebrew)
-- Dumped by pg_dump version 17.9 (Homebrew)

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
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: application_status; Type: TYPE; Schema: public; Owner: zubao_user
--

CREATE TYPE public.application_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);


ALTER TYPE public.application_status OWNER TO zubao_user;

--
-- Name: attendance_status; Type: TYPE; Schema: public; Owner: zubao_user
--

CREATE TYPE public.attendance_status AS ENUM (
    'on_duty',
    'off_duty',
    'resting'
);


ALTER TYPE public.attendance_status OWNER TO zubao_user;

--
-- Name: customer_type; Type: TYPE; Schema: public; Owner: zubao_user
--

CREATE TYPE public.customer_type AS ENUM (
    'registered',
    'walk_in'
);


ALTER TYPE public.customer_type OWNER TO zubao_user;

--
-- Name: membership_status; Type: TYPE; Schema: public; Owner: zubao_user
--

CREATE TYPE public.membership_status AS ENUM (
    'pending',
    'active',
    'left',
    'removed'
);


ALTER TYPE public.membership_status OWNER TO zubao_user;

--
-- Name: order_status; Type: TYPE; Schema: public; Owner: zubao_user
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'in_service',
    'completed',
    'cancelled'
);


ALTER TYPE public.order_status OWNER TO zubao_user;

--
-- Name: order_type; Type: TYPE; Schema: public; Owner: zubao_user
--

CREATE TYPE public.order_type AS ENUM (
    'scheduled',
    'designated'
);


ALTER TYPE public.order_type OWNER TO zubao_user;

--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: zubao_user
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'paid'
);


ALTER TYPE public.payment_status OWNER TO zubao_user;

--
-- Name: payroll_cycle_status; Type: TYPE; Schema: public; Owner: zubao_user
--

CREATE TYPE public.payroll_cycle_status AS ENUM (
    'draft',
    'reviewing',
    'paid'
);


ALTER TYPE public.payroll_cycle_status OWNER TO zubao_user;

--
-- Name: payroll_scope_type; Type: TYPE; Schema: public; Owner: zubao_user
--

CREATE TYPE public.payroll_scope_type AS ENUM (
    'shop_default',
    'technician_override'
);


ALTER TYPE public.payroll_scope_type OWNER TO zubao_user;

--
-- Name: service_status; Type: TYPE; Schema: public; Owner: zubao_user
--

CREATE TYPE public.service_status AS ENUM (
    'available',
    'in_service',
    'resting'
);


ALTER TYPE public.service_status OWNER TO zubao_user;

--
-- Name: shop_role_in_membership; Type: TYPE; Schema: public; Owner: zubao_user
--

CREATE TYPE public.shop_role_in_membership AS ENUM (
    'merchant_owner',
    'merchant_manager',
    'technician'
);


ALTER TYPE public.shop_role_in_membership OWNER TO zubao_user;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: zubao_user
--

CREATE TYPE public.user_role AS ENUM (
    'merchant',
    'technician'
);


ALTER TYPE public.user_role OWNER TO zubao_user;

--
-- Name: user_status; Type: TYPE; Schema: public; Owner: zubao_user
--

CREATE TYPE public.user_status AS ENUM (
    'active',
    'disabled'
);


ALTER TYPE public.user_status OWNER TO zubao_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: zubao_user
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    phone character varying(32),
    gender character varying(20),
    note text,
    is_member boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_visit_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    total_spent_cents bigint DEFAULT 0 NOT NULL,
    total_recharged_cents bigint DEFAULT 0 NOT NULL,
    member_level integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.customers OWNER TO zubao_user;

--
-- Name: merchant_profiles; Type: TABLE; Schema: public; Owner: zubao_user
--

CREATE TABLE public.merchant_profiles (
    user_id uuid NOT NULL,
    display_name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.merchant_profiles OWNER TO zubao_user;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: zubao_user
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    technician_user_id uuid NOT NULL,
    service_item_id uuid,
    order_no character varying(50) NOT NULL,
    order_type public.order_type NOT NULL,
    status public.order_status DEFAULT 'in_service'::public.order_status NOT NULL,
    room_code character varying(50),
    customer_name character varying(100),
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    service_amount integer NOT NULL,
    actual_amount integer NOT NULL,
    note text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    room_id uuid,
    customer_id uuid,
    customer_type public.customer_type DEFAULT 'walk_in'::public.customer_type NOT NULL,
    duration_minutes integer DEFAULT 60
);


ALTER TABLE public.orders OWNER TO zubao_user;

--
-- Name: payroll_cycles; Type: TABLE; Schema: public; Owner: zubao_user
--

CREATE TABLE public.payroll_cycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    cycle_month date NOT NULL,
    status public.payroll_cycle_status DEFAULT 'draft'::public.payroll_cycle_status NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payroll_cycles OWNER TO zubao_user;

--
-- Name: payroll_order_items; Type: TABLE; Schema: public; Owner: zubao_user
--

CREATE TABLE public.payroll_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payroll_summary_id uuid NOT NULL,
    order_id uuid NOT NULL,
    order_type public.order_type NOT NULL,
    service_amount integer NOT NULL,
    commission_rate numeric(5,4) DEFAULT 0 NOT NULL,
    commission_amount integer DEFAULT 0 NOT NULL,
    designated_bonus_amount integer DEFAULT 0 NOT NULL,
    included_in_salary boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payroll_order_items OWNER TO zubao_user;

--
-- Name: payroll_rules; Type: TABLE; Schema: public; Owner: zubao_user
--

CREATE TABLE public.payroll_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    scope_type public.payroll_scope_type NOT NULL,
    technician_user_id uuid,
    base_salary integer DEFAULT 0 NOT NULL,
    scheduled_commission_rate numeric(5,4) DEFAULT 0 NOT NULL,
    designated_commission_rate numeric(5,4) DEFAULT 0 NOT NULL,
    designated_bonus_amount integer DEFAULT 0 NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payroll_rules_check CHECK ((((scope_type = 'shop_default'::public.payroll_scope_type) AND (technician_user_id IS NULL)) OR ((scope_type = 'technician_override'::public.payroll_scope_type) AND (technician_user_id IS NOT NULL))))
);


ALTER TABLE public.payroll_rules OWNER TO zubao_user;

--
-- Name: payroll_summaries; Type: TABLE; Schema: public; Owner: zubao_user
--

CREATE TABLE public.payroll_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payroll_cycle_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    technician_user_id uuid NOT NULL,
    rule_snapshot jsonb NOT NULL,
    completed_order_count integer DEFAULT 0 NOT NULL,
    scheduled_amount_total integer DEFAULT 0 NOT NULL,
    designated_amount_total integer DEFAULT 0 NOT NULL,
    scheduled_commission_amount integer DEFAULT 0 NOT NULL,
    designated_commission_amount integer DEFAULT 0 NOT NULL,
    designated_bonus_total integer DEFAULT 0 NOT NULL,
    base_salary_amount integer DEFAULT 0 NOT NULL,
    gross_salary_amount integer DEFAULT 0 NOT NULL,
    payment_status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    paid_at timestamp with time zone,
    paid_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payroll_summaries OWNER TO zubao_user;

--
-- Name: rooms; Type: TABLE; Schema: public; Owner: zubao_user
--

CREATE TABLE public.rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    name character varying(80) NOT NULL,
    room_type character varying(80),
    note text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.rooms OWNER TO zubao_user;

--
-- Name: service_items; Type: TABLE; Schema: public; Owner: zubao_user
--

CREATE TABLE public.service_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    service_mode public.order_type NOT NULL,
    list_price integer NOT NULL,
    duration_minutes integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    description text
);


ALTER TABLE public.service_items OWNER TO zubao_user;

--
-- Name: shop_join_applications; Type: TABLE; Schema: public; Owner: zubao_user
--

CREATE TABLE public.shop_join_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    technician_user_id uuid NOT NULL,
    status public.application_status DEFAULT 'pending'::public.application_status NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    review_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.shop_join_applications OWNER TO zubao_user;

--
-- Name: shop_staff_memberships; Type: TABLE; Schema: public; Owner: zubao_user
--

CREATE TABLE public.shop_staff_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_in_shop public.shop_role_in_membership NOT NULL,
    membership_status public.membership_status DEFAULT 'active'::public.membership_status NOT NULL,
    joined_at timestamp with time zone,
    left_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.shop_staff_memberships OWNER TO zubao_user;

--
-- Name: shops; Type: TABLE; Schema: public; Owner: zubao_user
--

CREATE TABLE public.shops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_user_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    manager_name character varying(100),
    contact_phone character varying(32),
    address text,
    qr_code_url text,
    subscription_plan character varying(50) DEFAULT 'trial'::character varying NOT NULL,
    subscription_status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    subscription_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    opening_hours character varying(32)
);


ALTER TABLE public.shops OWNER TO zubao_user;

--
-- Name: technician_profiles; Type: TABLE; Schema: public; Owner: zubao_user
--

CREATE TABLE public.technician_profiles (
    user_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    avatar_url text,
    bio text,
    specialties jsonb DEFAULT '[]'::jsonb NOT NULL,
    years_experience integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    employee_no character varying(20)
);


ALTER TABLE public.technician_profiles OWNER TO zubao_user;

--
-- Name: technician_work_status_logs; Type: TABLE; Schema: public; Owner: zubao_user
--

CREATE TABLE public.technician_work_status_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    technician_user_id uuid NOT NULL,
    attendance_status public.attendance_status NOT NULL,
    service_status public.service_status NOT NULL,
    changed_by uuid NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.technician_work_status_logs OWNER TO zubao_user;

--
-- Name: user_refresh_tokens; Type: TABLE; Schema: public; Owner: zubao_user
--

CREATE TABLE public.user_refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_refresh_tokens OWNER TO zubao_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: zubao_user
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role public.user_role NOT NULL,
    phone character varying(32) NOT NULL,
    password_hash text NOT NULL,
    status public.user_status DEFAULT 'active'::public.user_status NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO zubao_user;

--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: zubao_user
--

COPY public.customers (id, shop_id, name, phone, gender, note, is_member, is_active, last_visit_at, created_at, updated_at, total_spent_cents, total_recharged_cents, member_level) FROM stdin;
c2e6bb3b-4abe-4d01-ad78-9d10d6348906	30000000-0000-0000-0000-000000000001	张三	13256323698	male	\N	f	t	2026-05-09 00:26:38.499928+08	2026-04-30 16:53:50.612074+08	2026-05-09 00:26:38.499928+08	0	0	1
\.


--
-- Data for Name: merchant_profiles; Type: TABLE DATA; Schema: public; Owner: zubao_user
--

COPY public.merchant_profiles (user_id, display_name, created_at, updated_at) FROM stdin;
10000000-0000-0000-0000-000000000001	Frank Zhang	2026-04-30 16:29:05.984702+08	2026-04-30 16:29:05.984702+08
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: zubao_user
--

COPY public.orders (id, shop_id, technician_user_id, service_item_id, order_no, order_type, status, room_code, customer_name, start_time, end_time, service_amount, actual_amount, note, created_by, created_at, updated_at, room_id, customer_id, customer_type, duration_minutes) FROM stdin;
\.


--
-- Data for Name: payroll_cycles; Type: TABLE DATA; Schema: public; Owner: zubao_user
--

COPY public.payroll_cycles (id, shop_id, cycle_month, status, started_at, closed_at, paid_at, created_by, created_at, updated_at) FROM stdin;
5f3678bc-1ad5-4beb-860c-fc722cd5749a	30000000-0000-0000-0000-000000000001	2026-05-01	draft	2026-05-07 14:08:42.052048+08	\N	\N	10000000-0000-0000-0000-000000000001	2026-05-07 14:08:42.052048+08	2026-05-07 14:08:42.052048+08
\.


--
-- Data for Name: payroll_order_items; Type: TABLE DATA; Schema: public; Owner: zubao_user
--

COPY public.payroll_order_items (id, payroll_summary_id, order_id, order_type, service_amount, commission_rate, commission_amount, designated_bonus_amount, included_in_salary, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payroll_rules; Type: TABLE DATA; Schema: public; Owner: zubao_user
--

COPY public.payroll_rules (id, shop_id, scope_type, technician_user_id, base_salary, scheduled_commission_rate, designated_commission_rate, designated_bonus_amount, effective_from, effective_to, is_active, created_at, updated_at) FROM stdin;
70000000-0000-0000-0000-000000000001	30000000-0000-0000-0000-000000000001	shop_default	\N	300000	0.3500	0.4500	8000	2026-03-31	2026-05-06	f	2026-04-30 16:29:05.984702+08	2026-05-07 13:10:12.033396+08
05c2ed0b-b8b9-44d9-9c2d-7bec73a0de81	30000000-0000-0000-0000-000000000001	shop_default	\N	0	0.4000	0.5000	1000	2026-05-07	2026-05-06	f	2026-05-07 13:10:12.036063+08	2026-05-07 13:10:17.646952+08
68900f3c-dfce-44d3-9efd-b3e65acb2356	30000000-0000-0000-0000-000000000001	shop_default	\N	0	0.4000	0.5000	1000	2026-05-07	\N	t	2026-05-07 13:10:17.647703+08	2026-05-07 13:10:17.647703+08
d4895644-3c18-4294-9338-467a15600e0d	30000000-0000-0000-0000-000000000001	technician_override	20000000-0000-0000-0000-000000000001	500000	0.2000	0.3500	5000	2026-05-08	2026-05-07	f	2026-05-08 15:24:20.021741+08	2026-05-08 15:25:13.344777+08
7ed65dc4-d82a-438c-aaeb-e98d56864614	30000000-0000-0000-0000-000000000001	technician_override	20000000-0000-0000-0000-000000000001	0	0.2000	0.3500	0	2026-05-08	2026-05-07	f	2026-05-08 15:25:13.347767+08	2026-05-08 15:31:56.364349+08
e488f1a9-d970-4858-92df-7362d4893d7c	30000000-0000-0000-0000-000000000001	technician_override	20000000-0000-0000-0000-000000000001	200000	0.5000	0.6000	2000	2026-05-08	2026-05-07	f	2026-05-08 15:31:56.366153+08	2026-05-09 00:37:15.714321+08
f2a3fabe-a4f9-44cb-b456-aba4bf15997a	30000000-0000-0000-0000-000000000001	technician_override	20000000-0000-0000-0000-000000000001	0	0.2000	0.3500	0	2026-05-08	2026-05-07	f	2026-05-09 00:37:41.959087+08	2026-05-09 00:38:18.28767+08
\.


--
-- Data for Name: payroll_summaries; Type: TABLE DATA; Schema: public; Owner: zubao_user
--

COPY public.payroll_summaries (id, payroll_cycle_id, shop_id, technician_user_id, rule_snapshot, completed_order_count, scheduled_amount_total, designated_amount_total, scheduled_commission_amount, designated_commission_amount, designated_bonus_total, base_salary_amount, gross_salary_amount, payment_status, paid_at, paid_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: rooms; Type: TABLE DATA; Schema: public; Owner: zubao_user
--

COPY public.rooms (id, shop_id, name, room_type, note, is_active, created_at, updated_at) FROM stdin;
e1566c0e-0ee0-41b4-94eb-75a55055a58c	30000000-0000-0000-0000-000000000001	102	2		t	2026-04-30 17:05:40.461174+08	2026-04-30 17:21:34.330693+08
5ce50a39-75c7-44e9-a000-dbf8864fc043	30000000-0000-0000-0000-000000000001	101	1	222	t	2026-04-30 16:53:30.795988+08	2026-05-12 23:32:17.130139+08
\.


--
-- Data for Name: service_items; Type: TABLE DATA; Schema: public; Owner: zubao_user
--

COPY public.service_items (id, shop_id, name, service_mode, list_price, duration_minutes, is_active, created_at, updated_at, description) FROM stdin;
01de2b7d-2f24-439f-a226-4c6bf5b26ed9	30000000-0000-0000-0000-000000000001	足疗	designated	39800	90	t	2026-05-07 16:08:35.411661+08	2026-05-07 16:08:35.411661+08	\N
35feddaa-bcae-4bad-9265-0d8a065caa65	30000000-0000-0000-0000-000000000001	按摩	scheduled	29800	60	t	2026-04-30 16:53:12.521716+08	2026-05-07 16:08:50.781911+08	
\.


--
-- Data for Name: shop_join_applications; Type: TABLE DATA; Schema: public; Owner: zubao_user
--

COPY public.shop_join_applications (id, shop_id, technician_user_id, status, applied_at, reviewed_at, reviewed_by, review_note, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: shop_staff_memberships; Type: TABLE DATA; Schema: public; Owner: zubao_user
--

COPY public.shop_staff_memberships (id, shop_id, user_id, role_in_shop, membership_status, joined_at, left_at, created_at, updated_at) FROM stdin;
c59eceeb-01ff-488f-962b-b24c6beea799	30000000-0000-0000-0000-000000000001	10000000-0000-0000-0000-000000000001	merchant_owner	active	2025-11-01 16:29:05.984702+08	\N	2026-04-30 16:29:05.984702+08	2026-04-30 16:29:05.984702+08
f5c44907-3223-4b30-b02b-06a1abb8a7e6	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	technician	active	2026-03-31 16:29:05.984702+08	\N	2026-04-30 16:29:05.984702+08	2026-04-30 16:29:05.984702+08
\.


--
-- Data for Name: shops; Type: TABLE DATA; Schema: public; Owner: zubao_user
--

COPY public.shops (id, owner_user_id, name, manager_name, contact_phone, address, qr_code_url, subscription_plan, subscription_status, subscription_expires_at, created_at, updated_at, opening_hours) FROM stdin;
30000000-0000-0000-0000-000000000001	10000000-0000-0000-0000-000000000001	御足堂	孔凡红	13256320254	东营港经济开发区		professional	active	2026-10-27 16:29:05.984702+08	2026-04-30 16:29:05.984702+08	2026-05-12 22:20:26.318887+08	12:00-04:00
\.


--
-- Data for Name: technician_profiles; Type: TABLE DATA; Schema: public; Owner: zubao_user
--

COPY public.technician_profiles (user_id, name, avatar_url, bio, specialties, years_experience, created_at, updated_at, employee_no) FROM stdin;
20000000-0000-0000-0000-000000000001	林婉儿	\N	用于测试技师端工作台、收益与资料维护。	["足底按摩", "中医经络推拿"]	6	2026-04-30 16:29:05.984702+08	2026-04-30 16:29:05.984702+08	8001
20000000-0000-0000-0000-000000000002	周小雅	\N	用于测试未签约技师资料展示。	["肩颈舒缓"]	3	2026-04-30 16:29:05.984702+08	2026-04-30 16:29:05.984702+08	8002
\.


--
-- Data for Name: technician_work_status_logs; Type: TABLE DATA; Schema: public; Owner: zubao_user
--

COPY public.technician_work_status_logs (id, shop_id, technician_user_id, attendance_status, service_status, changed_by, changed_at) FROM stdin;
379c1522-8dae-4c22-a4eb-07342bad0422	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	available	10000000-0000-0000-0000-000000000001	2026-04-30 16:19:05.984702+08
45348861-2a51-4224-87c2-0fae08b69aae	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	resting	available	10000000-0000-0000-0000-000000000001	2026-05-01 01:59:46.104487+08
e87f136f-f5ad-410c-9879-acf8d5054a64	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	available	10000000-0000-0000-0000-000000000001	2026-05-01 01:59:46.903968+08
fff0ea3c-f3c9-442f-903d-e6fe1a9666f6	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	resting	available	10000000-0000-0000-0000-000000000001	2026-05-01 11:01:39.564235+08
a663d04b-d0d2-45df-bd0b-e8e97ba2e548	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	available	10000000-0000-0000-0000-000000000001	2026-05-01 11:04:40.214811+08
0bdd27cf-76a6-4213-a1e0-474a6cf9b8b5	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	resting	available	10000000-0000-0000-0000-000000000001	2026-05-08 15:32:51.816074+08
76a7950e-ba56-4a2b-8f6c-569931d5168e	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	available	10000000-0000-0000-0000-000000000001	2026-05-08 15:33:01.185664+08
e36beb27-2814-443e-9cad-9fc30aceba00	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	available	10000000-0000-0000-0000-000000000001	2026-05-08 20:50:07.209725+08
912c473b-4744-41f0-9f95-9f17f8289fd7	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	in_service	10000000-0000-0000-0000-000000000001	2026-05-08 20:50:42.178915+08
4bf0032f-74b7-46e0-840e-09c0f867e53c	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	available	10000000-0000-0000-0000-000000000001	2026-05-08 20:50:59.434256+08
0798e2da-2d9b-41d7-a63b-5e5d15b33aaf	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	in_service	10000000-0000-0000-0000-000000000001	2026-05-08 21:37:52.419651+08
c378a3bf-0926-4d3d-b023-5a9d6bddbf44	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	available	10000000-0000-0000-0000-000000000001	2026-05-08 21:50:06.359404+08
a80c19db-740b-4fae-99e4-5b9047171541	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	in_service	10000000-0000-0000-0000-000000000001	2026-05-08 21:54:16.96305+08
bdf99bef-50f8-43b3-a2b1-935864e245ec	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	available	10000000-0000-0000-0000-000000000001	2026-05-08 21:54:36.831408+08
d10e8969-2790-4d4b-a266-401d0c75e7b5	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	in_service	10000000-0000-0000-0000-000000000001	2026-05-08 22:17:53.983077+08
a11f9346-8ba2-4023-a714-f0c532906fd4	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	available	10000000-0000-0000-0000-000000000001	2026-05-08 23:38:48.425539+08
0cfac351-00ca-4053-85de-25f7a5a64ec3	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	in_service	10000000-0000-0000-0000-000000000001	2026-05-08 23:50:17.660542+08
401dbef0-d592-4285-a5a8-db3509415c49	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	in_service	10000000-0000-0000-0000-000000000001	2026-05-09 00:23:04.458843+08
ebd6ffa4-b013-4c15-937b-24ec20b5ef37	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	available	10000000-0000-0000-0000-000000000001	2026-05-09 00:23:19.478034+08
a1ee845f-346f-4ff3-bced-71fbef038dd7	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	on_duty	available	10000000-0000-0000-0000-000000000001	2026-05-09 00:26:38.511382+08
7951fcbe-d9db-4758-ac53-2feed1d84fc6	30000000-0000-0000-0000-000000000001	20000000-0000-0000-0000-000000000001	resting	resting	20000000-0000-0000-0000-000000000001	2026-05-15 21:23:28.982145+08
\.


--
-- Data for Name: user_refresh_tokens; Type: TABLE DATA; Schema: public; Owner: zubao_user
--

COPY public.user_refresh_tokens (id, user_id, token, expires_at, revoked_at, created_at) FROM stdin;
0fbd7755-e1d8-4bd0-bfdc-d75f76624a02	10000000-0000-0000-0000-000000000001	dc6b8f9408123a1abe8521ae079ca3eeb523364a77bf56f6a0ef05cc7f955403	2026-05-30 18:32:43.176+08	\N	2026-04-30 18:32:43.177157+08
1d2b93ea-d2a8-4a5b-ac69-5afc29ca2c51	10000000-0000-0000-0000-000000000001	42e03f8f3909bafc1c535d4945ec69b4cc0490e45a918454458f9c496c4c7c67	2026-06-05 11:52:55.452+08	2026-05-06 14:07:21.029667+08	2026-05-06 11:52:55.455603+08
426580f9-b9b5-4c5e-8f1b-e9e53a2532e1	10000000-0000-0000-0000-000000000001	83a8cfb4cdc2855e754156bd31c7258756fbcb6844d2b1ffaca24b35393e76e8	2026-05-30 16:56:34.87+08	2026-05-01 01:41:01.452094+08	2026-04-30 16:56:34.870508+08
b3a642d8-f8dc-4056-bdae-3237505e0891	10000000-0000-0000-0000-000000000001	244d36c4cc2e26c6c62db762fc6c5201c0fd7543d96e3acaa21ec934a9550252	2026-05-31 01:41:01.451+08	\N	2026-05-01 01:41:01.454407+08
f2012303-3612-4146-8be7-cddec1cce7ac	10000000-0000-0000-0000-000000000001	d20703ea4f4ba5e6571361693a3fc746d06df02a2f2d6a1d0e8b059ce398a02f	2026-05-31 14:32:55.969+08	2026-05-05 15:14:32.857661+08	2026-05-01 14:32:55.970063+08
01d2d575-0259-4d1e-94cb-a0bbc97c60c2	10000000-0000-0000-0000-000000000001	c02a2827067a82ea84aa4c7cec651daead4add652ec167ec55b818612d6d2087	2026-05-30 16:46:14.355+08	2026-05-01 02:32:08.821027+08	2026-04-30 16:46:14.355462+08
edf64d78-e5d6-4a01-a56b-5e56358b0878	10000000-0000-0000-0000-000000000001	3b330153bdd237de7d6c4bbabae59b313dadf9dffa7f02ffeea86b17b2c31e92	2026-05-31 02:32:08.82+08	\N	2026-05-01 02:32:08.827413+08
ae34b319-7c50-4441-b272-c0728e13d5e2	10000000-0000-0000-0000-000000000001	0a13ffb2db4c91a7ec28e37c755c285465ec6612a5aaaa6870b5a6ef34a04a04	2026-06-04 15:14:32.857+08	\N	2026-05-05 15:14:32.862106+08
34cade3e-a498-4e3f-92d2-faaac409212c	10000000-0000-0000-0000-000000000001	4c2ddbd84afacde1896581fc0fbb061e233e1cf9fe699db9f897800e51930c03	2026-05-31 01:41:01.452+08	2026-05-01 09:57:59.144209+08	2026-05-01 01:41:01.454286+08
12d98a0c-4d5b-405b-b926-d62300dcd504	10000000-0000-0000-0000-000000000001	30109a8b678b87a8d99cffe0eb91a10b4490b7b85aa4f755ac2c833e2b1c5b73	2026-05-31 09:57:59.144+08	\N	2026-05-01 09:57:59.148558+08
dc84daaf-180f-4c22-b85f-a45eaf583450	10000000-0000-0000-0000-000000000001	c622c0ce3133ce9cdfe13d22caf38f4c8abd4c458d69ed255d8689a7840448ea	2026-06-04 15:14:32.857+08	\N	2026-05-05 15:14:32.86225+08
fb814d16-3d5a-4ef8-b3ce-83dd581fd55c	10000000-0000-0000-0000-000000000001	29d4cdda13acdfdf3030bf6aab80542feb444158550a146717a796b5cb695959	2026-05-31 02:32:08.82+08	2026-05-01 11:05:12.407696+08	2026-05-01 02:32:08.827509+08
9f63ca61-3513-482b-9436-987feccb35fa	10000000-0000-0000-0000-000000000001	657ef2c7bb4ff044dba2ba6e126e09b991fb11a1411e0362819e246778ed221a	2026-05-31 11:05:12.407+08	\N	2026-05-01 11:05:12.411866+08
d34552cd-ae4f-4f93-9fc7-57f65b2860c0	10000000-0000-0000-0000-000000000001	aae3cf62cbf8813f1e389d09145c5fe70086cc73ca629b29037e89fe3271e7c8	2026-05-31 11:05:12.407+08	\N	2026-05-01 11:05:12.412351+08
f12df684-c9dd-45fd-b2f5-e3b9696f8a0d	10000000-0000-0000-0000-000000000001	1bb792efcea243daf827f291ca11c2289257531b5653efdb020aa4170ca11999	2026-05-31 11:40:17.291+08	\N	2026-05-01 11:40:17.292868+08
68f032d9-8c9b-434f-b80f-93f735847fda	10000000-0000-0000-0000-000000000001	529a90fcf28a5cfafdbf96772f7e03573128a35381d75475568579d53a940fb0	2026-06-04 15:33:46.942+08	\N	2026-05-05 15:33:46.942769+08
990efb56-eab1-41d1-a1a7-4474e2a64862	10000000-0000-0000-0000-000000000001	f591049a5448b64681ffca6c7f1f57a746f813d42c34c62f1c7523f8402eb3c8	2026-05-31 12:04:46.934+08	\N	2026-05-01 12:04:46.936593+08
2a189047-03b0-4107-9f56-9035f28f6ba3	10000000-0000-0000-0000-000000000001	bba4d4798bfdac33b81c6287cc14795aafaf309c911dd78b9d0b7271b4901eb8	2026-05-31 09:57:59.144+08	2026-05-01 12:04:46.936707+08	2026-05-01 09:57:59.148362+08
969dc537-cd18-48b2-a8cc-f26ab390ddf6	10000000-0000-0000-0000-000000000001	b5b6479205edb01047093cf906ca2b033f67fed85da2f416385518391359156a	2026-05-31 12:04:46.936+08	\N	2026-05-01 12:04:46.937882+08
255b8fba-bd11-44f4-9e3a-c7265f92642e	10000000-0000-0000-0000-000000000001	8e87afb149393ba21051f43fbb856d14d52bdea9d6fdb2dd81c1ffc981cfb579	2026-05-31 14:34:19.319+08	\N	2026-05-01 14:34:19.319127+08
1dcbc6e7-ca08-48d0-b2b1-506571e65316	10000000-0000-0000-0000-000000000001	b0c747c68ddd17e32e8f202dda52f165f2f34dd387e066bad817feca365d57d9	2026-05-31 14:51:26.257+08	\N	2026-05-01 14:51:26.258484+08
df590952-8aa4-444d-800b-ef3b6e00af1e	10000000-0000-0000-0000-000000000001	8b5949410fe9341f097b2559d1f9e1b2db17ffd6813486a407c94d147f1d519d	2026-05-31 14:57:47.499+08	\N	2026-05-01 14:57:47.500107+08
d429b25e-a8f4-4b27-9179-75bd899e9987	10000000-0000-0000-0000-000000000001	9c5fcb450c5111700c0828da557b06f22164928b709fdf72d148750436dde115	2026-06-04 15:54:04.676+08	\N	2026-05-05 15:54:04.676678+08
0d88fea4-d711-46ac-a23c-5b82834f122e	10000000-0000-0000-0000-000000000001	aad7b942ccca7a56fba789c30a1a5e629403878d2635b0c7a56c060996a22edb	2026-05-30 16:29:47.514+08	2026-05-02 23:17:51.021264+08	2026-04-30 16:29:47.514532+08
4202d112-791e-4c5f-85f9-5366914a5cad	10000000-0000-0000-0000-000000000001	af291ed7d06f2f23d2ea2d736207e3772eb4bed91273d5db0372f9a69f050882	2026-06-01 23:17:51.021+08	\N	2026-05-02 23:17:51.026409+08
41049758-990e-4cd0-9558-c6f3b5545c43	10000000-0000-0000-0000-000000000001	5ade2c2c73bdedaab91b3c4817ae862ea511b8456d6e13a89212e9938c684064	2026-06-02 01:16:19.486+08	\N	2026-05-03 01:16:19.486487+08
43abc53e-303f-48b9-a74f-a367095c0fe6	10000000-0000-0000-0000-000000000001	7b4670cb4b8d75f8affd9d5ff7b11bb74da0ad5e528269fb8cdd83a23d316bf7	2026-06-02 01:27:48.946+08	\N	2026-05-03 01:27:48.947172+08
aff79d6a-8e5a-4771-9db0-f0e5fb9e2d41	10000000-0000-0000-0000-000000000001	e613c0e38f7d252bbdfb1b3593f6689190bdeda402d452092b742422b743ad84	2026-06-02 01:38:51.027+08	\N	2026-05-03 01:38:51.027595+08
11b2a2b0-d0b2-4714-acf9-bf39d84f4ee4	10000000-0000-0000-0000-000000000001	1368de3fda722498907f656663d56055a42d903d58ebb6c0f0e95516b4d6505d	2026-06-02 01:40:22.521+08	\N	2026-05-03 01:40:22.522286+08
971c4821-fe7b-409b-85f1-0824778906b9	10000000-0000-0000-0000-000000000001	f7b07339c962558270fb1a37ee5524c4738d694bd77e390e06119a6d5018df3f	2026-06-05 08:39:59.401+08	\N	2026-05-06 08:39:59.401146+08
1310ea05-3a69-4324-938e-84fddfed8ba4	10000000-0000-0000-0000-000000000001	418bc2eed58958dd64a69ae8a1d9ae0bee522a53d5fcb780359ae4880cc7afba	2026-05-31 14:58:49.026+08	2026-05-03 01:41:25.577627+08	2026-05-01 14:58:49.026229+08
e9730a0d-a659-442d-8f3a-b41e95d2377c	10000000-0000-0000-0000-000000000001	e3ba8a7fd5f26cdbe2bf84b060d933bca954b4c18b07b0a687ec3af1bc009106	2026-06-02 01:41:25.577+08	\N	2026-05-03 01:41:25.578649+08
8d504149-0780-48a7-80e1-130bf0855f19	10000000-0000-0000-0000-000000000001	9cf961216aab84f213c12190ab4cab645a1f8748ac3cf4ff52540715ffa7ba3f	2026-06-02 01:41:25.577+08	\N	2026-05-03 01:41:25.578837+08
73167041-bf46-4b6e-a232-c5c2f3ed700a	10000000-0000-0000-0000-000000000001	cd8d7252d38d29b33d559bc07d08ea71fc4e4ac454eacd9a09fcb66362c53fc7	2026-06-01 23:17:51.021+08	2026-05-03 01:45:21.065976+08	2026-05-02 23:17:51.026512+08
45a34d37-fb09-4500-9ce5-1bab824b304b	10000000-0000-0000-0000-000000000001	07e05e1db50129500e8cca3b728af972845b91912fd74b530a60d6bb3f42c71d	2026-06-02 01:45:21.065+08	\N	2026-05-03 01:45:21.066905+08
1db60c03-11f9-452c-9874-10bbab0737ab	10000000-0000-0000-0000-000000000001	81e7edd264c3fdeed6465de09fa18b859c07a4133b252901a4aaa49845fcf130	2026-06-02 01:45:54.744+08	\N	2026-05-03 01:45:54.744811+08
8118d64d-6b7a-49c8-91f8-50753a022cfc	10000000-0000-0000-0000-000000000001	00f4365db3fa65b6e99eec1eecec601ea6ef22b7d1bba95178bee710758b861e	2026-06-02 02:15:13.333+08	\N	2026-05-03 02:15:13.33464+08
180b3f38-bbf4-42fe-bfc8-c6bf97ff66b2	10000000-0000-0000-0000-000000000001	909bcc33c8c3735604551315afe644993bf22e85bc5ad222faf6432d9486c968	2026-06-02 02:15:49.574+08	\N	2026-05-03 02:15:49.574746+08
43a096ae-40a4-4a39-93cc-f0b3701adc18	10000000-0000-0000-0000-000000000001	02ed01616f8e17e20be8c2809770c16e2827df09034fd360bc76b82e38b05307	2026-06-05 08:50:34.642+08	\N	2026-05-06 08:50:34.643542+08
1f4e76b2-ed65-460f-aa0b-e3125fedd914	10000000-0000-0000-0000-000000000001	ca323fcfbbf2eb89344c15204316d6390c203150d5536d3599df7a82ae4e87b9	2026-06-05 08:56:10.464+08	\N	2026-05-06 08:56:10.464365+08
5539b893-9bff-4db2-968e-0d4c34c02325	10000000-0000-0000-0000-000000000001	80a99d6f265207adfe658bf16fdd7f2893e04550a0604b9a1f9e9837273bc4c2	2026-06-05 08:56:21.009+08	\N	2026-05-06 08:56:21.009604+08
f14cbebf-6181-472c-a21b-ad16643ddce2	10000000-0000-0000-0000-000000000001	0c614301da3265ead9e0d56cf15b02eadd0c960443d965321b5c91ed4e981b69	2026-06-05 08:56:30.105+08	\N	2026-05-06 08:56:30.105081+08
3ea14f9b-0225-4d0d-91ce-e354ec2c7a99	10000000-0000-0000-0000-000000000001	49f9a8cbffbd51bb3acce5e1899b2a92b81848cf030a548d9f49369f3bb38304	2026-06-05 08:40:37.361+08	2026-05-06 11:52:55.452652+08	2026-05-06 08:40:37.361088+08
c26a835a-44f1-4ee6-9884-efedb528f75d	10000000-0000-0000-0000-000000000001	064ac63f28c529605a83f328f5302f992f6a383cbe57eb0f084e8b5bd796913d	2026-05-31 11:58:07.696+08	2026-05-06 12:55:24.130602+08	2026-05-01 11:58:07.69694+08
8a0cb290-ba5d-4fd5-9674-ab7278c8921d	10000000-0000-0000-0000-000000000001	49d0222402628a75b172a48a75b7a0e1f3eb66f46798bdf35727399d1b89fa56	2026-06-05 12:55:24.13+08	\N	2026-05-06 12:55:24.133073+08
4d4d86e7-f32a-45da-b915-fb970073f29d	10000000-0000-0000-0000-000000000001	cfdf14bee2de2da7e6c4dd71ac8f03cc2e4baddd0915533ee6df9fd5079183d6	2026-06-05 16:35:36.281+08	2026-05-07 08:13:37.649881+08	2026-05-06 16:35:36.28359+08
9e459504-6278-40e8-9c61-d74c219534fc	10000000-0000-0000-0000-000000000001	b0b1b9a47ac0bfd6302590f9ca9302ee8f9defd9184e5320fdfb268ed9136aa7	2026-06-05 14:07:21.029+08	2026-05-06 16:35:36.281822+08	2026-05-06 14:07:21.030782+08
ba01904f-a515-4d2d-b5ae-0ef910804e78	10000000-0000-0000-0000-000000000001	8713e6df03a1cde17dc8668ec350b55bd557fd2d72ef97e7e8475c025aa3e437	2026-06-05 16:35:36.281+08	\N	2026-05-06 16:35:36.283519+08
4214a598-0644-466b-acc9-394147c71371	10000000-0000-0000-0000-000000000001	1fce2228459675a09e82cf772143da12125aa2f23b08c7bcf7be6c1940f9333a	2026-06-06 08:13:37.649+08	\N	2026-05-07 08:13:37.650956+08
18294dec-b47f-4915-8843-9143bee895ca	10000000-0000-0000-0000-000000000001	2c6fe46960dbe4a2923a97bfce80a172a2baf6e837b35234bcb20076c3cb95b2	2026-06-06 09:17:43.226+08	\N	2026-05-07 09:17:43.22623+08
c4647991-e966-484d-ba5a-ee50e22833ce	10000000-0000-0000-0000-000000000001	24d482d1369bcd35fd65b1f02792d98252d3703ea8c83c1d63771b3386031622	2026-06-06 09:18:19.751+08	\N	2026-05-07 09:18:19.751297+08
c0f7c1e5-81ae-4e21-8ed4-243b427e4089	10000000-0000-0000-0000-000000000001	c5180e5e7cfe0add488588800275c5d844325c3afd3e1a01bc46287e456a8f60	2026-06-06 09:21:51.721+08	\N	2026-05-07 09:21:51.72154+08
e1c4368e-7d99-4fc4-a5a0-00057944ff87	10000000-0000-0000-0000-000000000001	1fdc17b80cbdbba81512d83ea52bb2a1eabe8f01808817a5c6e9ccbd0e12f133	2026-06-02 01:45:21.065+08	2026-05-07 21:30:52.102994+08	2026-05-03 01:45:21.067089+08
925b2e2d-4d1b-41fc-a94c-1868f647c441	10000000-0000-0000-0000-000000000001	e43ff1542d07c7db2eb3d1ed7a8eb3d4a5fc6fe6e325b03761cc838e8f1975c9	2026-06-06 09:30:39.31+08	2026-05-07 12:28:56.234741+08	2026-05-07 09:30:39.310651+08
89262525-4268-4819-a400-a3d236badc76	10000000-0000-0000-0000-000000000001	97232184954c308a2182a38f9dfc749b4e629e4f5abf31855ef282c5d8555da3	2026-06-06 12:28:56.233+08	\N	2026-05-07 12:28:56.242486+08
2b480786-cd2e-4315-9a1e-3cfa884f69f0	10000000-0000-0000-0000-000000000001	b8e6b06712c9694491af5f854f81b9e1b83f5c0417420f954a6787d1c5677810	2026-06-06 10:50:50.543+08	2026-05-07 13:09:37.358953+08	2026-05-07 10:50:50.543424+08
283f08fb-f428-48da-8884-da30da65022a	10000000-0000-0000-0000-000000000001	e17c13ca4a7667b6a50d62b98515c60b9b8c9feb4766f7e3ddc47cc2ef630da4	2026-06-06 13:09:37.358+08	\N	2026-05-07 13:09:37.36353+08
ba45ed50-76d8-4c85-b8e4-01f01a76776d	10000000-0000-0000-0000-000000000001	4c696322ff25c4753ea15acffe35264c1127723baaeddb7dc7f27cf142ab6bf9	2026-06-06 13:34:54.446+08	\N	2026-05-07 13:34:54.446134+08
73580f91-a575-4922-95e1-aba399e38047	20000000-0000-0000-0000-000000000001	7c6f3d16e425f842b18146ad028427e0c4553c7bc6b3af3f1aec9d1038ae79ae	2026-06-06 13:35:26.679+08	2026-05-07 13:35:54.269567+08	2026-05-07 13:35:26.679934+08
1aeaa5ee-716b-4626-8bac-f6b7a8665629	20000000-0000-0000-0000-000000000001	1180bf87fdde0207e05a87587acebdd2f30ede8e12d727fe794c87613f2d2125	2026-06-06 13:35:59.461+08	2026-05-07 13:36:30.302342+08	2026-05-07 13:35:59.461338+08
48a24d7c-6428-49ba-b62e-e0dc421a6c75	10000000-0000-0000-0000-000000000001	4cf441a1636dceb166a76ce178c0f2ad74326f02bac38f19353762b64b2d8ea1	2026-06-06 12:28:56.233+08	2026-05-07 14:50:38.824545+08	2026-05-07 12:28:56.243526+08
f493e1a3-b7e4-45f9-847c-a61b5ee84aae	10000000-0000-0000-0000-000000000001	24d17c8c0b3064beff8e31635b04cfc67eb1e00833fb30418bff55d8d7a948ed	2026-06-06 14:50:38.824+08	\N	2026-05-07 14:50:38.829614+08
7f61a83b-bef4-4563-bb0e-675bd94dc7d8	10000000-0000-0000-0000-000000000001	47681af576f860913b5b9ed132bef5e39d61b912e875f52e022bd1fdf0ae1a35	2026-06-06 14:50:38.824+08	\N	2026-05-07 14:50:38.82941+08
9e6a488e-8b51-4ed9-8c61-f87c43fdbb8a	10000000-0000-0000-0000-000000000001	6ad587cf8fe575113aacbb446da672c2e6e0681a0ea28243b9d4426bf0fb996c	2026-06-06 14:50:38.824+08	\N	2026-05-07 14:50:38.829752+08
7f3718a9-b4cd-4310-95c7-9d79b05aa96c	10000000-0000-0000-0000-000000000001	2e9f8daf5071ec825d851b0100497a71c19b2322c123298f1f6b04ccc616e2ea	2026-06-06 13:36:32.524+08	2026-05-07 15:58:38.545922+08	2026-05-07 13:36:32.524638+08
5a7c626c-76ef-4ecd-aefa-7769514c9203	10000000-0000-0000-0000-000000000001	7a42071033f98b17f13b6d0e0bba3d37d5a80f32f76d4e9337deb2c39d91aeda	2026-06-06 15:58:38.545+08	\N	2026-05-07 15:58:38.552356+08
0484a501-8764-4a19-9ae0-8d7a60e62182	10000000-0000-0000-0000-000000000001	1631880b7eac0f05e1ee616074734b2c2ed4d4c7dc80888fdb50bc196653e80c	2026-06-06 15:58:38.546+08	\N	2026-05-07 15:58:38.552569+08
4f8885a2-0a0b-4020-83cf-84dc25a4f031	10000000-0000-0000-0000-000000000001	adaef3c2a5e9cf0351cb537ce7439d4dd3e9509b53a6dc8ed7b22d0ecfa64a3c	2026-06-06 21:30:52.102+08	\N	2026-05-07 21:30:52.103597+08
aea1731a-37b2-40fc-ae18-ca61cce6a4f2	10000000-0000-0000-0000-000000000001	c5be66f3948f3a9541644511ca18d25ce18b4b38638cf6d07270e85742df8203	2026-06-06 20:51:01.532+08	2026-05-07 23:00:18.574252+08	2026-05-07 20:51:01.532521+08
028cb980-2eb9-48ca-99de-6f7124a6c620	10000000-0000-0000-0000-000000000001	d5aa1ea1a842943cd0a00312ff70ec3850b0845549d399721f0d8a073f68f7fa	2026-06-06 15:58:38.545+08	2026-05-07 23:01:49.862175+08	2026-05-07 15:58:38.552753+08
859f82eb-21aa-4341-8c5b-5c37ab5c681b	10000000-0000-0000-0000-000000000001	f925e912ad80ce414469f530487e6872bab442c7e3bee4748bff3e534c7dc156	2026-06-06 23:07:56.779+08	\N	2026-05-07 23:07:56.779936+08
50bf147e-dfaa-4c9a-bc17-265039e85242	10000000-0000-0000-0000-000000000001	63fc816c156db9c99390ed5754cc31453a446ed98c432efd22ddc3a781290539	2026-06-06 23:01:49.862+08	2026-05-08 11:58:54.423328+08	2026-05-07 23:01:49.862859+08
742929f3-302b-4918-97c8-807336146521	10000000-0000-0000-0000-000000000001	0a419e4a0d272cb0320f64a9263d25046fc28ff55178b914f3d1422b39bf12e1	2026-06-07 11:58:54.423+08	\N	2026-05-08 11:58:54.428231+08
15cfd527-a3b5-4089-932d-0a9974c82379	10000000-0000-0000-0000-000000000001	068ed7267dca02875598658e1e2d59013c17dd9827b51fa425eae3dac5df44c1	2026-06-07 15:06:02.991+08	\N	2026-05-08 15:06:02.991745+08
a2389a99-aa96-47c4-9adc-8a20496514ca	10000000-0000-0000-0000-000000000001	9534c82fec69c0c8a4d6b661b47693f6e499e2dfbeb2bdcd7b4e0b0a71e2fafe	2026-06-07 15:44:56.218+08	\N	2026-05-08 15:44:56.218934+08
24e5f8dd-5738-453f-a428-562abff41c10	10000000-0000-0000-0000-000000000001	f0f605063058e15010a2ea12e20a12583d1bf00baa0f9f50ce4c898749309cb4	2026-06-06 23:00:18.574+08	2026-05-08 21:27:34.970023+08	2026-05-07 23:00:18.575276+08
7c70fb08-c551-4d7d-9c6b-1a2ac37c5b71	10000000-0000-0000-0000-000000000001	f294a7b2d0869bbc523111aa54238fc2fe973e0e95072ce85b8b2e0491a98b28	2026-06-07 21:27:34.969+08	\N	2026-05-08 21:27:34.971938+08
acbc9170-23ff-4d8a-960f-7e9c3270077e	10000000-0000-0000-0000-000000000001	f3db5ee97603f076d9c83c4c40587f0a8c669a25a9ff33ce336595f1f53a67ab	2026-06-07 21:27:34.969+08	\N	2026-05-08 21:27:34.971715+08
90b6aed3-53f6-44fc-96e6-51144523f496	10000000-0000-0000-0000-000000000001	e8fb8efda56f092a6ed4f4cfb42f232051a8602b37fbddbdafae32e2a1e1b57b	2026-06-07 21:29:19.013+08	2026-05-08 23:38:34.381248+08	2026-05-08 21:29:19.013238+08
f5e095d1-609e-4b00-abfb-091d1155193c	10000000-0000-0000-0000-000000000001	1a68ce915f834e807d6b291ab85a2374b4d803d7e37b52b07d135809996d31c6	2026-06-07 23:38:34.381+08	\N	2026-05-08 23:38:34.384136+08
a51322a8-72bd-4d6d-84f5-e198dd6d6590	10000000-0000-0000-0000-000000000001	d083f3d2453b6a02c99b09f4684fdcf576fa6ee91614caf49e48b9aab8fc35f2	2026-06-07 23:38:34.38+08	\N	2026-05-08 23:38:34.384039+08
ce22235f-56dd-4679-bb98-ebb4d1aeb06b	10000000-0000-0000-0000-000000000001	9ab69e8ce206460d4974285b4578900758440d08dfcd2f77a5210e2781551d76	2026-06-08 00:22:08.829+08	\N	2026-05-09 00:22:08.829975+08
98bf0ef5-4c62-4150-bc72-0e7f33173e2e	10000000-0000-0000-0000-000000000001	7b999cc462d45df831a844188044498528b3b27cc6a76d146e251ba394df87ae	2026-06-08 00:25:00.539+08	\N	2026-05-09 00:25:00.540027+08
0751dd13-0486-4d74-a7c3-4c37b03d2b8d	10000000-0000-0000-0000-000000000001	2858445764ce6d4e823a6124a7c8c95659fa411625ef4ad2423b6b8d30ccee05	2026-06-08 00:33:06.321+08	\N	2026-05-09 00:33:06.321569+08
75323362-a4a2-4b75-a9df-55b09c1ea55b	10000000-0000-0000-0000-000000000001	5b27a329a7bd82e73943cb133c428d7bcbff9944db67bf9f73102ab5692ef6fb	2026-06-08 00:39:05.966+08	\N	2026-05-09 00:39:05.966363+08
8087702f-4931-402a-bb16-dbd1b4884b38	10000000-0000-0000-0000-000000000001	9a736061cb209b52863613e68db03bc5333c2021a86dc203b63b83a6b1e52031	2026-06-08 00:42:07.292+08	\N	2026-05-09 00:42:07.292171+08
29b63c18-b185-4715-8c1c-119cca27fa3c	10000000-0000-0000-0000-000000000001	1567ee196b83c0d681b1f89ccaf6755f247f863cc608483e78b79999ad0bc612	2026-06-08 00:44:25.419+08	\N	2026-05-09 00:44:25.420088+08
be7cef9e-f85a-40dd-adfa-4a6993b6230c	10000000-0000-0000-0000-000000000001	6bb0abdea954befc8a83ea8832fcf1b6708bfd8f7de23d0fa06e0a195cfda5ce	2026-06-08 00:47:27.208+08	\N	2026-05-09 00:47:27.2083+08
fdde6356-92fc-47ad-80d0-962b5c807803	10000000-0000-0000-0000-000000000001	764f6c048523bacdb8f5a8fc9bcf9823dfe703a83a808cf1a7fade6befebf4e4	2026-06-08 00:53:41.556+08	\N	2026-05-09 00:53:41.557042+08
6f380f8d-9ffb-475d-a69d-e774c3f3eb0e	10000000-0000-0000-0000-000000000001	5852c121f7e103304f9d0c3ef71036c9f3243643a24fdde1e1538ab23643ab52	2026-06-08 00:58:09.425+08	\N	2026-05-09 00:58:09.42591+08
95d5d51b-241f-494f-8039-a3bc5861523d	10000000-0000-0000-0000-000000000001	d14719f8bd306dd0f604d09b257feb3bc31b44f78c9b93997b85094f05f60f32	2026-06-08 01:01:34.392+08	\N	2026-05-09 01:01:34.392734+08
409ad890-5198-477b-8faa-78962c24de42	10000000-0000-0000-0000-000000000001	fb5c2c1d16734c22b2b4fa4a7f93a73f07340df9436cabcfd59b37306a37f734	2026-06-09 15:20:31.7+08	\N	2026-05-10 15:20:31.700643+08
f588b76f-99cd-4652-9c68-600469a953f4	20000000-0000-0000-0000-000000000001	28f5a36408b44f7785e4015f48a676695f77169974bc33e857c51bf95368da9e	2026-06-09 15:20:42.664+08	2026-05-10 15:20:44.330209+08	2026-05-10 15:20:42.664207+08
dd045046-72f6-4a58-803c-3ac8a26f8c73	10000000-0000-0000-0000-000000000001	dc674097a8511db8fa7b29894ab31e722a876237bc23120a73edc7a84531660a	2026-06-08 00:59:53.211+08	2026-05-10 15:20:59.757816+08	2026-05-09 00:59:53.212059+08
c4abce71-4435-4583-ad7e-f7babf5ffd6b	10000000-0000-0000-0000-000000000001	6447d153b7c838d9717463ed170344e20e766d86b309554ff924766b7e38ae62	2026-06-09 15:20:59.757+08	\N	2026-05-10 15:20:59.782317+08
92de8f3b-8ba1-464b-ae79-583e55b79adc	10000000-0000-0000-0000-000000000001	9cfc5efdca0dab3731e0df056c17accc3efa163d77a2bfe00aabd8caf62d9758	2026-06-09 15:20:52.244+08	2026-05-10 16:00:43.67427+08	2026-05-10 15:20:52.244733+08
360b1d5b-e0cf-4c13-902a-43b0590a76b7	10000000-0000-0000-0000-000000000001	1c8d5d815d3aea0d57a1137d70f10bf900032da6d6b8ac50b705166a04884d29	2026-06-09 16:00:43.674+08	\N	2026-05-10 16:00:43.676611+08
76b32bf8-75ef-428d-85b7-e0571dce2fa1	10000000-0000-0000-0000-000000000001	612f14a00410814a30f86ec5b1a26d67a1a316b1161286d9ce8d728370d8c7d5	2026-06-09 15:20:59.757+08	2026-05-10 16:00:50.125556+08	2026-05-10 15:20:59.78298+08
e8fbdf51-0c21-46da-88e8-ba89985c1af7	10000000-0000-0000-0000-000000000001	4986dadf69043d87909c47c3f6d0ca395e3af88d003e1d7d8bc0d210559e7cb0	2026-06-09 16:00:50.125+08	\N	2026-05-10 16:00:50.126753+08
ce916256-9b62-4546-88c0-46488747c1d6	10000000-0000-0000-0000-000000000001	8f79d27e846af8b41539d450d3de4b63fe03f137a9f0c641f5c2ea48893a8152	2026-06-09 17:26:49.213+08	\N	2026-05-10 17:26:49.21374+08
d289824a-36e9-4b4e-8aef-9858a5c76a3e	10000000-0000-0000-0000-000000000001	40eca81a9be98d22ab19ed72081d80daa711f4617cf7cf76105dc81c376b8854	2026-06-09 17:22:08.384+08	2026-05-10 19:28:26.29954+08	2026-05-10 17:22:08.384668+08
01008d56-3b93-419d-a379-827c7f2554c8	10000000-0000-0000-0000-000000000001	d3669e354cc7e9574822a3354062d8c7838e33c23c1952a02cf4ef794e2feae2	2026-06-09 19:28:26.299+08	\N	2026-05-10 19:28:26.304083+08
121af97a-dada-4017-93bb-05cdacbac726	10000000-0000-0000-0000-000000000001	0db23fec9da624f334ce41cf14ba00908659b3876836d36c979a477922f83061	2026-06-09 19:28:26.299+08	\N	2026-05-10 19:28:26.304244+08
0a74b35d-278a-4e4a-8710-566bf82c2caf	20000000-0000-0000-0000-000000000001	c99ec760af91f139e4a08b3ddea1900ce8847de886836e5b13064e0ba6444ca6	2026-06-09 19:34:17.604+08	2026-05-10 19:56:42.171077+08	2026-05-10 19:34:17.60422+08
6fbf89cf-39c0-49bb-b56e-bede4231c85f	10000000-0000-0000-0000-000000000001	b6286e113ff2526f288a44d9c1144384408de793c27a5d49ba450194293028de	2026-06-09 19:56:43.492+08	\N	2026-05-10 19:56:43.492837+08
83b444a8-36cd-4b06-9b43-ac94c2a36a7d	20000000-0000-0000-0000-000000000001	7738a7ada86d76afe2021b051076ccd52c0b58fe47ea49d840958b2a51d6c0c2	2026-06-09 21:15:55.895+08	\N	2026-05-10 21:15:55.895591+08
aad96d79-48ce-4e46-b050-ec9fa8de1ef7	20000000-0000-0000-0000-000000000001	d9710c2d31f881e256308858ffb3443e5a025635be9dea11dda2f3151ebfaddb	2026-06-09 21:16:22.503+08	\N	2026-05-10 21:16:22.503535+08
710f1382-780e-452b-a64f-1c4f7190f2c0	20000000-0000-0000-0000-000000000001	161c8f3e478384f4333ef984de932b409c4780cb0e24779c6b600dd9d0aa8a8c	2026-06-09 21:21:52.437+08	\N	2026-05-10 21:21:52.438044+08
d1c46f35-4cc5-42b6-bcab-0b17bb855c02	20000000-0000-0000-0000-000000000001	4b71cb1b8c77e156c024f615c707d80754eb9d9c548903c581fc69491bbc3cd4	2026-06-09 21:31:05.904+08	\N	2026-05-10 21:31:05.904852+08
bff94400-12a5-46ac-8bf4-7970b3adf624	20000000-0000-0000-0000-000000000001	cad50eec19bedd6cc3ea005e900900da036e08eaed224dc143edc3a8d1710830	2026-06-09 21:31:14.703+08	\N	2026-05-10 21:31:14.70336+08
570f7104-b21f-48fc-b7e2-71466ed9c251	20000000-0000-0000-0000-000000000001	0487a3ac364538d39f8eb3c61265866b93b5f25c47f7b1c333ce10976271f765	2026-06-09 21:32:14.951+08	\N	2026-05-10 21:32:14.951549+08
6ccfc7e2-7a4b-451c-a9cf-53cf618672da	20000000-0000-0000-0000-000000000001	a9da99c4cab23fd748b8299e97bd5fa6e5cb263970d32e184bb2bd7c832beed8	2026-06-09 21:34:00.849+08	\N	2026-05-10 21:34:00.849632+08
1881b5a8-ed4a-45f6-80f5-1481094fa200	20000000-0000-0000-0000-000000000001	8eb6a0acaf17a8ddf73fa184b91c60611b332048f7facd64bc57b8977383da18	2026-06-09 21:34:10.109+08	\N	2026-05-10 21:34:10.10938+08
83d2f6c0-ddc2-4fd7-bb16-01433db338c5	20000000-0000-0000-0000-000000000001	a4928f9526496c45f3a367b9ee331ec2dd694a9af750c3892926298d22e03610	2026-06-09 21:34:44.359+08	\N	2026-05-10 21:34:44.359249+08
d2e3da8b-b43c-4ff4-8cc9-a940a6199c41	20000000-0000-0000-0000-000000000001	223f334e3fd41a2adb081678d45d16dabcbff28e6b0ed989579adf545a5b4ac0	2026-06-09 21:36:25.739+08	\N	2026-05-10 21:36:25.739151+08
75c3c39b-f613-42c1-b0f7-1bb5039301cc	10000000-0000-0000-0000-000000000001	d449af5f7b53933c4e14be8a764d9a13e65d14c49d0b6292373c0a09e4100526	2026-06-09 22:43:53.555+08	\N	2026-05-10 22:43:53.555379+08
abe78b93-cbf7-4643-8b43-4db5bfb4326a	10000000-0000-0000-0000-000000000001	60aa689eab2a1584d7adfa4deed3f9252d402c2174422423d7bc5c6c60ad4a1b	2026-06-10 11:56:45.551+08	\N	2026-05-11 11:56:45.551388+08
fd7c01d6-e23b-4228-a5be-8ec0b45da725	10000000-0000-0000-0000-000000000001	75b6cfabae13f37e833ec592babeda336cec46717a0325d642d7771eacfd2dfe	2026-06-10 11:59:36.546+08	\N	2026-05-11 11:59:36.546979+08
859b84f0-dad9-4567-bece-a5f6c6aed849	10000000-0000-0000-0000-000000000001	00fbda8470609e506bfaaab377047465b982c942081b69bde4bdf576853716f1	2026-06-10 12:01:45.887+08	\N	2026-05-11 12:01:45.887637+08
17561741-ffa7-4ccf-b8e2-b4956ae048fa	20000000-0000-0000-0000-000000000001	0b2adef0d13d05b607cf903f879d9bfdb698827c48a5b1531b25b84579bcc344	2026-06-10 12:39:09.78+08	\N	2026-05-11 12:39:09.7811+08
ea8f994b-9730-477b-bfe4-242b7c559005	10000000-0000-0000-0000-000000000001	665804be792b400a85e0330f10e989123eac706d8e350e8740b9784c8ac6a7ae	2026-06-10 12:39:16.846+08	\N	2026-05-11 12:39:16.84673+08
e792fa7f-b48d-402f-bf0c-9c26d872acf5	20000000-0000-0000-0000-000000000001	b22d6e25dee35a76b2e13b3abd96505dc214df8381bbd651b3a79790cc03f720	2026-06-10 12:39:36.237+08	\N	2026-05-11 12:39:36.237434+08
251c8b76-3958-42eb-8bee-3f8905b68c4b	10000000-0000-0000-0000-000000000001	1f994eb24cdac99f5d6358d0894de69952aada12027555bb6ce1266af6fba8d0	2026-06-10 12:40:06.018+08	\N	2026-05-11 12:40:06.018861+08
439e8387-f85f-4d73-ab8f-1d03547bf546	20000000-0000-0000-0000-000000000001	fde40bd884233820c1ef7799970ed804172a8089b88442f7b240b5cd0b9bb801	2026-06-10 13:17:32.916+08	\N	2026-05-11 13:17:32.916208+08
5a7e1c17-b21a-43d4-97b6-b0f244bb7a05	10000000-0000-0000-0000-000000000001	7a8d5b5497fe5241ad5f26b41c109f3671cbacaf846d2fb04a92ea26fbfeda30	2026-06-10 15:48:13.937+08	\N	2026-05-11 15:48:13.93796+08
97b51a16-f89e-43df-a4db-80b909162850	20000000-0000-0000-0000-000000000001	216e3e5fb90db8f3940779bce5e150114f87c7289220eb43ca64b5cf9b4836b3	2026-06-10 15:48:36.176+08	\N	2026-05-11 15:48:36.176826+08
332595b5-50fb-4b35-acd9-dfd115853fbd	10000000-0000-0000-0000-000000000001	6205d929d280af2ec885bab61129fbeb8b76c5d88def9bd4acc4c40ef9232b33	2026-06-10 15:48:59.356+08	\N	2026-05-11 15:48:59.357066+08
65fa6e1e-4abc-43ef-8372-6b94d30a1f28	20000000-0000-0000-0000-000000000001	d61cfd0738eef8636286ce270fe7138ebd753cec3ceacc947e174c4fb243745e	2026-06-10 15:49:09.98+08	\N	2026-05-11 15:49:09.980919+08
b1bd0e60-29f8-4182-9d4f-b4cd1cdb4a34	20000000-0000-0000-0000-000000000001	19adf5902b874b3692c264e2108734bef1dabbf81c032f2fd6ff22ae4a6bf258	2026-06-10 16:07:01.745+08	\N	2026-05-11 16:07:01.745689+08
d907c2bf-4cbd-42f8-857e-f093841d3464	20000000-0000-0000-0000-000000000001	4b23058fe2d3851940d4f32bfaa64098adb044b31064ed19a958af9f783a1747	2026-06-10 12:02:01.306+08	2026-05-12 14:55:25.340935+08	2026-05-11 12:02:01.306994+08
e3b2d582-2f92-4e6a-b4c6-09e96243837d	20000000-0000-0000-0000-000000000001	c0575333fefc3504fbc0595d5a40c8f76a9956ca029881f876ebe8623344b775	2026-06-11 14:55:25.34+08	\N	2026-05-12 14:55:25.353001+08
30a25f99-88d5-42cd-b10a-ff33514e0779	10000000-0000-0000-0000-000000000001	0234c004218a0e3b04721420386901e356a1a92a472cc5945efc7ab488e5ad3e	2026-06-11 15:15:28.592+08	\N	2026-05-12 15:15:28.592858+08
8646b188-d0bc-4db1-bfb9-2e2637848d1c	10000000-0000-0000-0000-000000000001	0ef978c723842b7fefd3d83f4412801143c4129032726e0ab51aedf82576ad80	2026-06-11 15:15:37.266+08	\N	2026-05-12 15:15:37.266694+08
c000201f-bfaf-4ca6-a45d-a3b16eee430d	10000000-0000-0000-0000-000000000001	5cb73e30b040139fc413be21439115948df3db203d6cf2543e50b1ddfd309d4b	2026-06-11 15:37:35.75+08	\N	2026-05-12 15:37:35.7501+08
429fdb0b-fdc5-49f1-85e7-28164d574cf5	10000000-0000-0000-0000-000000000001	553dc2c0de2ab2126cc96268f3b9903884156979300137fa32d67e57a4fa8973	2026-06-11 15:46:35.476+08	\N	2026-05-12 15:46:35.47709+08
597cf825-edcf-4185-bc9f-e1edd278291c	10000000-0000-0000-0000-000000000001	a75db03fcc2257a5eb7adb1647da7c3c2db2c367bc364d75def2b5c6eb956113	2026-06-11 15:55:56.814+08	\N	2026-05-12 15:55:56.814864+08
b41330a8-d10e-4d59-ba34-33f57e00ca8d	10000000-0000-0000-0000-000000000001	5245e43f1f8c2ccad0d5219c62fe240198822045f9ab418b7c9d9b432b4648bf	2026-06-11 15:57:26.119+08	\N	2026-05-12 15:57:26.119147+08
23c6796d-d10e-4d95-bd1e-13f1a95a7f51	10000000-0000-0000-0000-000000000001	19ed5f4aaf848bd7d4dff7654d4e76c477676aa9f59dc24c6f47a67d24ad4b9a	2026-06-11 16:00:05.767+08	\N	2026-05-12 16:00:05.767531+08
35a0c3c5-e2df-42cc-a284-c6695ba67da4	10000000-0000-0000-0000-000000000001	16b11d00e84701adf028490cf48a81c2254239e8f93dd6c73d05f2fc8a775452	2026-06-11 16:18:52.92+08	\N	2026-05-12 16:18:52.92074+08
f235e5b3-4ee0-4cbc-81be-f678c730d18b	10000000-0000-0000-0000-000000000001	74803e3d3d7c966480fdc8cbef657885474df954934aa6a1774b87055b7c989b	2026-06-11 16:20:24.358+08	\N	2026-05-12 16:20:24.358406+08
2a031121-5f5e-4f11-b790-68e38bf04fbe	10000000-0000-0000-0000-000000000001	8f07fb9632dd3b703a4717302d664b126fd6ce1e7eb38c98ca5962214dc47acc	2026-06-11 16:25:52.388+08	\N	2026-05-12 16:25:52.388524+08
1aa2a947-25df-4b4e-ab34-785d847a41d1	10000000-0000-0000-0000-000000000001	7d5da8801dcbc739c40968ab0b8edb848c84f79db7d6f73b8b3418beefb44339	2026-06-11 16:28:23.083+08	\N	2026-05-12 16:28:23.083607+08
dcd170bd-3de5-43f9-9e73-0f58063b8ccf	10000000-0000-0000-0000-000000000001	914b58cb2d3b9b288acc27fc7ef3ceb79adc0624129f030f4ab4228e2883ba89	2026-06-11 16:31:05.769+08	\N	2026-05-12 16:31:05.769813+08
183fd365-76cf-4f6d-8f28-2f6d78916e26	10000000-0000-0000-0000-000000000001	360a26984aefdf429daec5ad38bf8410acd3700ce42a7d9b87e9270792db7a8a	2026-06-11 16:32:51.341+08	\N	2026-05-12 16:32:51.341082+08
9cbe0a5a-c406-44b5-9ce5-69cb0fe426ba	10000000-0000-0000-0000-000000000001	2d9540843066ecc8d1adcc73993f882cc05a309facbb0131a527ecb1babb9ac5	2026-06-11 21:35:26.781+08	\N	2026-05-12 21:35:26.781351+08
0fdcae45-8aee-415f-b380-32fdadde6699	10000000-0000-0000-0000-000000000001	c4893bd7b3937ad09a04571a9a8c5dcf4d4753fdd501e7500fdce83ffc336f6f	2026-06-11 22:05:21.51+08	\N	2026-05-12 22:05:21.510703+08
4f16aa68-68a8-43bb-abc1-bc4212aee6b8	20000000-0000-0000-0000-000000000001	4836f6496711fe7993dd7b117cbdb82ca64f04700ad4985d69a5f1160e44e16d	2026-06-11 22:13:26.401+08	\N	2026-05-12 22:13:26.401509+08
356d02fd-6ffc-4e06-b894-a74ccb2b5077	10000000-0000-0000-0000-000000000001	294b62cbcbccb48aa5776309268c2584e33f79cfa969795330a9a4eb69b452f6	2026-06-11 22:20:44.739+08	\N	2026-05-12 22:20:44.739589+08
da536c1d-d9fd-4eef-bb22-d9c6ebffebab	10000000-0000-0000-0000-000000000001	001daa7df1309ed89e92170ad43e21160f225d34f25719e73e1b8e0bfa150dd5	2026-06-11 22:27:10.171+08	\N	2026-05-12 22:27:10.171164+08
3a7a09a5-6f10-4b0c-a6fa-a191e37b6b5d	10000000-0000-0000-0000-000000000001	deb56eab53b8b92f61e7d8d1c31f1f4e1a4e79236af43f384a89b282db144819	2026-06-11 22:35:34.929+08	\N	2026-05-12 22:35:34.92993+08
9ea8c6df-c2ad-40bf-bea3-4de426a6b6fc	10000000-0000-0000-0000-000000000001	1926a8d2506efab715675f2c61b4087ced10fc4a25264b9e89f28aadd8124d08	2026-06-11 22:40:47.841+08	\N	2026-05-12 22:40:47.841629+08
098cda86-343e-4ddc-8d23-7e8531a19b1f	10000000-0000-0000-0000-000000000001	c7bc1fa77205aea791f98934d4688a157ea732336a1de34dd5a67235843e0fd5	2026-06-11 22:45:56.854+08	\N	2026-05-12 22:45:56.854481+08
3248f1c0-cc53-41fd-82a4-c77735c4dfcd	10000000-0000-0000-0000-000000000001	8f3d1cb9a8d77fca38e579a275158be38712bcc08372868d1a6cd3c54f1aadbd	2026-06-11 22:48:11.41+08	\N	2026-05-12 22:48:11.411094+08
892f8c40-ecc2-484a-88df-55b76bdeba67	10000000-0000-0000-0000-000000000001	c7d46d9a2bdcf6050c142dd1d48262fa60996a4824d227a7d8e66416cafc7190	2026-06-11 21:35:38.468+08	2026-05-12 23:35:50.915316+08	2026-05-12 21:35:38.468799+08
6b56352e-aa86-461d-ad02-a84e083ff343	10000000-0000-0000-0000-000000000001	28f948b9095482c57cd50c00695e5f095a5a63dac6dca57706b07f01e4872dc7	2026-06-11 23:35:50.915+08	\N	2026-05-12 23:35:50.916708+08
21a528e2-3471-460b-af2b-7667a7b6af8e	10000000-0000-0000-0000-000000000001	1c927ce1440a907c1491d5e7c899838912e643714266caa0e8e6608c9fbf74b9	2026-06-11 23:46:22.065+08	\N	2026-05-12 23:46:22.065322+08
7ac54203-ffbc-4104-9de2-59e475ac8033	10000000-0000-0000-0000-000000000001	057b5bbf1591f4665edd7c4cada15dc064fa2c287d70fbaa74b0a5a530e79586	2026-06-11 23:51:44.249+08	\N	2026-05-12 23:51:44.249458+08
fb5feea0-6cb1-4053-bac5-9c725e4fd3d4	10000000-0000-0000-0000-000000000001	1786fae43361b055ec97bb87ff8b94fba96457cee951c3a834f37eb7e0518125	2026-06-13 10:53:47.193+08	\N	2026-05-14 10:53:47.193791+08
6014b48f-f04c-476a-af49-28689107de94	20000000-0000-0000-0000-000000000001	bd3e963bf2a1777857c73fce928a28252cac93f7135ed66fd4fa622d22bb1bef	2026-06-13 10:54:31.123+08	2026-05-14 13:53:46.085138+08	2026-05-14 10:54:31.123093+08
4a9da459-80f0-4f67-8c53-f1f7252c323b	20000000-0000-0000-0000-000000000001	de82b4b8e14811882fa6f85112df2f34ed309c0f3c876e0e492c3cd47cb9f797	2026-06-13 13:53:46.084+08	\N	2026-05-14 13:53:46.088871+08
8f559ea7-af9d-43cb-b584-771d07c4e25e	10000000-0000-0000-0000-000000000001	4f86894847d625002fd0631c3b01aa447991ba63eed3f5dbc0f25a73e53db6e7	2026-06-13 13:54:24.814+08	\N	2026-05-14 13:54:24.81442+08
5905ae4e-d05e-49e7-83e1-cfb25a5ab8aa	20000000-0000-0000-0000-000000000001	156f561be7ce2912a90eb0058b93af281b751402fd4ccd80a35fa918db5b89fc	2026-06-13 15:01:04.825+08	\N	2026-05-14 15:01:04.825766+08
e764bb06-7cd4-41db-905b-014e79aac984	20000000-0000-0000-0000-000000000001	cfa66ab64b13d19b01d33de03b5fa3774acece5c3cf8feb8ea088b2cdb04364a	2026-06-13 13:54:55.431+08	2026-05-14 16:07:58.661047+08	2026-05-14 13:54:55.431761+08
d307ad47-9052-4d5a-b96d-b6d17b8aa0c3	20000000-0000-0000-0000-000000000001	efabf568a987a03c58f7ae5cfcfb21da7554e626b8b030e15fb335a22bdbb0f4	2026-06-13 16:07:58.66+08	\N	2026-05-14 16:07:58.663837+08
429dfd48-fca7-4abe-99dd-8bf33fb84b49	20000000-0000-0000-0000-000000000001	aa517f58272004087d6db8061a0ab9b86488ab991f48e6c0268511b4d122d428	2026-06-13 13:56:46.908+08	2026-05-15 12:48:12.276433+08	2026-05-14 13:56:46.909048+08
ac1af47a-0cf8-489a-958e-225a3142fb9e	20000000-0000-0000-0000-000000000001	519383903561fef020dd043b258952c390abb5f68fb3a4d50128e04f3c35982b	2026-06-14 14:34:23.574+08	\N	2026-05-15 14:34:23.574976+08
8a4d7c25-2a37-4c4a-a3aa-2b68881c30ca	20000000-0000-0000-0000-000000000001	d812ded9292e4c88b38888d6e5776c854e80fbbdcf365c33c14b4fb404e076fb	2026-06-14 14:35:14.648+08	\N	2026-05-15 14:35:14.648614+08
fd2f2cbe-9f9b-47c1-aa5e-051b112d949f	20000000-0000-0000-0000-000000000001	f1b8dab5d6b1d2a759d01c5c76d2eb928ca52ef1773812895739962b8e048ee6	2026-06-14 14:50:49.083+08	\N	2026-05-15 14:50:49.084094+08
4038aa23-e904-4661-a602-0908edec3386	20000000-0000-0000-0000-000000000001	684c4693965f4f14337f44f46301568bce8a9d64728e1cf341108e96c5477ce7	2026-06-14 12:43:16.246+08	2026-05-15 14:52:42.237897+08	2026-05-15 12:43:16.247092+08
a195b021-2444-44fe-9aae-b148a4a0d030	20000000-0000-0000-0000-000000000001	424c3b214fdf2cb2bdba12f94e30c6d24ee7fc8f0b87b9fd7a3f6fb6ad694866	2026-06-14 12:48:12.276+08	2026-05-15 14:55:03.176819+08	2026-05-15 12:48:12.27895+08
bae715eb-7454-40a4-a073-176fce46e71b	20000000-0000-0000-0000-000000000001	be8d4f137377d41c3ebc273797dd067cfea62f276e0eab39ed9e6ed7fd3425ac	2026-06-14 15:34:52.253+08	\N	2026-05-15 15:34:52.253963+08
b67812c6-bbac-4cae-be58-b9a883dff5b8	20000000-0000-0000-0000-000000000001	c68dd820ec3d4f2a3b657dd8ff2afe209969db8262abfc19458d301fa831948a	2026-06-14 15:36:24.454+08	\N	2026-05-15 15:36:24.454861+08
4b8f7c26-7638-4995-8d76-3e7c8e0e36c6	20000000-0000-0000-0000-000000000001	a5bd3d71af366a88d91ee397389a443d2c90574c971a7b01f1014407fc1efd1a	2026-06-14 15:37:04.122+08	\N	2026-05-15 15:37:04.122799+08
b9ed8b5a-9c5e-4c5f-ac1d-fb25ebe987a3	10000000-0000-0000-0000-000000000001	1ec9622a496c99c7d2dc98199d62b8256954779e0a290f72b486a3c6cc566b17	2026-06-14 16:04:03.403+08	\N	2026-05-15 16:04:03.403156+08
887ca178-fb2d-4218-85a4-fe92e9e9c98d	20000000-0000-0000-0000-000000000001	7a363ea7cd1ea2b13645493742284c7879ca2a34f5e1960e282b78058440db14	2026-06-14 14:52:42.237+08	2026-05-15 20:17:33.605259+08	2026-05-15 14:52:42.239522+08
9fd459e0-8014-4471-9e4f-2b3d40a12550	20000000-0000-0000-0000-000000000001	5adf83270b2866ac70c35422c1fff32721f195360dcdb24fc3b524543a85eb8a	2026-06-14 20:17:33.605+08	\N	2026-05-15 20:17:33.608894+08
58b2368e-1aa1-49e9-91ed-a256bc2e7053	20000000-0000-0000-0000-000000000001	0b176a3d69506618c5614ef85d3ee7326eaace8c2e088d7164c6743c12f9cb60	2026-06-14 14:55:03.176+08	2026-05-15 20:18:12.521486+08	2026-05-15 14:55:03.177971+08
4509b685-985b-4a40-881e-a64c7f21e150	20000000-0000-0000-0000-000000000001	95eaeeead3eea65a541cc9b26ddb3ef91d5182d68d99d0e4aa41dc188f6bb261	2026-06-14 20:18:12.521+08	\N	2026-05-15 20:18:12.522344+08
7d3ef50e-2dbe-4e27-943a-9fb97ea148c3	10000000-0000-0000-0000-000000000001	38341423cab1e5fe1e171fb9f6b5f5e6918c3ce6f1a538a33e591756a267f4b0	2026-06-14 20:37:06.45+08	\N	2026-05-15 20:37:06.450463+08
141ea39a-5428-4708-a13c-39484a70f6a5	20000000-0000-0000-0000-000000000001	2bb708fc6a559797a78d4657c0244a2438bfa81c25075d09c3e853450c18c203	2026-06-14 20:38:13.198+08	\N	2026-05-15 20:38:13.198355+08
97d20ee1-65f5-4fee-8550-beef1080d4c4	20000000-0000-0000-0000-000000000001	933d1e9e78b49158b915600338d4ff140c037d7c9e9443f4573d1701dc3e12fa	2026-06-14 21:23:28.973+08	\N	2026-05-15 21:23:28.973921+08
1f0e4227-6784-4981-9178-a9026394c459	20000000-0000-0000-0000-000000000001	2d97fe2b252c8cea1985cae374d9b50e0013d6a66fd65b64b31bc6e4ebbded26	2026-06-14 16:04:15.478+08	2026-05-15 21:34:52.417951+08	2026-05-15 16:04:15.478377+08
77fbc635-172f-479e-8fca-21ab1ac3f003	20000000-0000-0000-0000-000000000001	d28009574bf49dc63f6c3615df247850f0410141058e0435b49f23b5f34845a5	2026-06-14 21:34:52.417+08	\N	2026-05-15 21:34:52.42024+08
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: zubao_user
--

COPY public.users (id, role, phone, password_hash, status, last_login_at, created_at, updated_at) FROM stdin;
20000000-0000-0000-0000-000000000001	technician	13800000011	scrypt$2d284a11baa0c918afc13f67e921a355$e963fb29ebf81cc72608e55300a7b72a7292b8477d08ca4355855dc4a8e3a99a0c31c8b76470cbd1a70e54a5ebbbb90bf0937bef931f86ec8e3c90654e5f1936	active	2026-05-15 21:23:28.961522+08	2026-04-30 16:29:05.984702+08	2026-05-15 21:23:28.961522+08
20000000-0000-0000-0000-000000000002	technician	13800000012	scrypt$2d284a11baa0c918afc13f67e921a355$e963fb29ebf81cc72608e55300a7b72a7292b8477d08ca4355855dc4a8e3a99a0c31c8b76470cbd1a70e54a5ebbbb90bf0937bef931f86ec8e3c90654e5f1936	active	\N	2026-04-30 16:29:05.984702+08	2026-04-30 16:29:05.984702+08
10000000-0000-0000-0000-000000000001	merchant	13800000001	scrypt$2d284a11baa0c918afc13f67e921a355$e963fb29ebf81cc72608e55300a7b72a7292b8477d08ca4355855dc4a8e3a99a0c31c8b76470cbd1a70e54a5ebbbb90bf0937bef931f86ec8e3c90654e5f1936	active	2026-05-15 20:37:06.449128+08	2026-04-30 16:29:05.984702+08	2026-05-15 20:37:06.449128+08
\.


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: merchant_profiles merchant_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.merchant_profiles
    ADD CONSTRAINT merchant_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: orders orders_order_no_key; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_no_key UNIQUE (order_no);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payroll_cycles payroll_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_cycles
    ADD CONSTRAINT payroll_cycles_pkey PRIMARY KEY (id);


--
-- Name: payroll_cycles payroll_cycles_shop_id_cycle_month_key; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_cycles
    ADD CONSTRAINT payroll_cycles_shop_id_cycle_month_key UNIQUE (shop_id, cycle_month);


--
-- Name: payroll_order_items payroll_order_items_payroll_summary_id_order_id_key; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_order_items
    ADD CONSTRAINT payroll_order_items_payroll_summary_id_order_id_key UNIQUE (payroll_summary_id, order_id);


--
-- Name: payroll_order_items payroll_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_order_items
    ADD CONSTRAINT payroll_order_items_pkey PRIMARY KEY (id);


--
-- Name: payroll_rules payroll_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_rules
    ADD CONSTRAINT payroll_rules_pkey PRIMARY KEY (id);


--
-- Name: payroll_summaries payroll_summaries_payroll_cycle_id_technician_user_id_key; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_summaries
    ADD CONSTRAINT payroll_summaries_payroll_cycle_id_technician_user_id_key UNIQUE (payroll_cycle_id, technician_user_id);


--
-- Name: payroll_summaries payroll_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_summaries
    ADD CONSTRAINT payroll_summaries_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_shop_id_name_key; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_shop_id_name_key UNIQUE (shop_id, name);


--
-- Name: service_items service_items_pkey; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.service_items
    ADD CONSTRAINT service_items_pkey PRIMARY KEY (id);


--
-- Name: shop_join_applications shop_join_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.shop_join_applications
    ADD CONSTRAINT shop_join_applications_pkey PRIMARY KEY (id);


--
-- Name: shop_staff_memberships shop_staff_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.shop_staff_memberships
    ADD CONSTRAINT shop_staff_memberships_pkey PRIMARY KEY (id);


--
-- Name: shop_staff_memberships shop_staff_memberships_shop_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.shop_staff_memberships
    ADD CONSTRAINT shop_staff_memberships_shop_id_user_id_key UNIQUE (shop_id, user_id);


--
-- Name: shops shops_pkey; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_pkey PRIMARY KEY (id);


--
-- Name: technician_profiles technician_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.technician_profiles
    ADD CONSTRAINT technician_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: technician_work_status_logs technician_work_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.technician_work_status_logs
    ADD CONSTRAINT technician_work_status_logs_pkey PRIMARY KEY (id);


--
-- Name: user_refresh_tokens user_refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.user_refresh_tokens
    ADD CONSTRAINT user_refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: user_refresh_tokens user_refresh_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.user_refresh_tokens
    ADD CONSTRAINT user_refresh_tokens_token_key UNIQUE (token);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_customers_shop_active_name; Type: INDEX; Schema: public; Owner: zubao_user
--

CREATE INDEX idx_customers_shop_active_name ON public.customers USING btree (shop_id, is_active, name);


--
-- Name: idx_orders_completed_for_payroll; Type: INDEX; Schema: public; Owner: zubao_user
--

CREATE INDEX idx_orders_completed_for_payroll ON public.orders USING btree (shop_id, technician_user_id, end_time) WHERE (status = 'completed'::public.order_status);


--
-- Name: idx_orders_shop_status_start_time; Type: INDEX; Schema: public; Owner: zubao_user
--

CREATE INDEX idx_orders_shop_status_start_time ON public.orders USING btree (shop_id, status, start_time DESC);


--
-- Name: idx_orders_shop_technician_start_time; Type: INDEX; Schema: public; Owner: zubao_user
--

CREATE INDEX idx_orders_shop_technician_start_time ON public.orders USING btree (shop_id, technician_user_id, start_time DESC);


--
-- Name: idx_payroll_order_items_summary; Type: INDEX; Schema: public; Owner: zubao_user
--

CREATE INDEX idx_payroll_order_items_summary ON public.payroll_order_items USING btree (payroll_summary_id);


--
-- Name: idx_payroll_rules_override_lookup; Type: INDEX; Schema: public; Owner: zubao_user
--

CREATE INDEX idx_payroll_rules_override_lookup ON public.payroll_rules USING btree (shop_id, technician_user_id, effective_from DESC) WHERE ((scope_type = 'technician_override'::public.payroll_scope_type) AND (is_active = true));


--
-- Name: idx_payroll_summaries_cycle_payment; Type: INDEX; Schema: public; Owner: zubao_user
--

CREATE INDEX idx_payroll_summaries_cycle_payment ON public.payroll_summaries USING btree (payroll_cycle_id, payment_status);


--
-- Name: idx_payroll_summaries_shop_technician; Type: INDEX; Schema: public; Owner: zubao_user
--

CREATE INDEX idx_payroll_summaries_shop_technician ON public.payroll_summaries USING btree (shop_id, technician_user_id);


--
-- Name: idx_refresh_tokens_expiry; Type: INDEX; Schema: public; Owner: zubao_user
--

CREATE INDEX idx_refresh_tokens_expiry ON public.user_refresh_tokens USING btree (expires_at);


--
-- Name: idx_refresh_tokens_token; Type: INDEX; Schema: public; Owner: zubao_user
--

CREATE INDEX idx_refresh_tokens_token ON public.user_refresh_tokens USING btree (token);


--
-- Name: idx_refresh_tokens_user; Type: INDEX; Schema: public; Owner: zubao_user
--

CREATE INDEX idx_refresh_tokens_user ON public.user_refresh_tokens USING btree (user_id);


--
-- Name: idx_work_status_latest; Type: INDEX; Schema: public; Owner: zubao_user
--

CREATE INDEX idx_work_status_latest ON public.technician_work_status_logs USING btree (shop_id, technician_user_id, changed_at DESC);


--
-- Name: uq_active_default_payroll_rule; Type: INDEX; Schema: public; Owner: zubao_user
--

CREATE UNIQUE INDEX uq_active_default_payroll_rule ON public.payroll_rules USING btree (shop_id) WHERE ((scope_type = 'shop_default'::public.payroll_scope_type) AND (is_active = true) AND (effective_to IS NULL));


--
-- Name: uq_active_technician_membership; Type: INDEX; Schema: public; Owner: zubao_user
--

CREATE UNIQUE INDEX uq_active_technician_membership ON public.shop_staff_memberships USING btree (user_id) WHERE ((role_in_shop = 'technician'::public.shop_role_in_membership) AND (membership_status = 'active'::public.membership_status));


--
-- Name: uq_pending_application_per_shop_technician; Type: INDEX; Schema: public; Owner: zubao_user
--

CREATE UNIQUE INDEX uq_pending_application_per_shop_technician ON public.shop_join_applications USING btree (shop_id, technician_user_id) WHERE (status = 'pending'::public.application_status);


--
-- Name: customers customers_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: merchant_profiles merchant_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.merchant_profiles
    ADD CONSTRAINT merchant_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: orders orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: orders orders_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id);


--
-- Name: orders orders_service_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_service_item_id_fkey FOREIGN KEY (service_item_id) REFERENCES public.service_items(id);


--
-- Name: orders orders_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: orders orders_technician_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_technician_user_id_fkey FOREIGN KEY (technician_user_id) REFERENCES public.users(id);


--
-- Name: payroll_cycles payroll_cycles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_cycles
    ADD CONSTRAINT payroll_cycles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: payroll_cycles payroll_cycles_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_cycles
    ADD CONSTRAINT payroll_cycles_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: payroll_order_items payroll_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_order_items
    ADD CONSTRAINT payroll_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;


--
-- Name: payroll_order_items payroll_order_items_payroll_summary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_order_items
    ADD CONSTRAINT payroll_order_items_payroll_summary_id_fkey FOREIGN KEY (payroll_summary_id) REFERENCES public.payroll_summaries(id) ON DELETE CASCADE;


--
-- Name: payroll_rules payroll_rules_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_rules
    ADD CONSTRAINT payroll_rules_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: payroll_rules payroll_rules_technician_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_rules
    ADD CONSTRAINT payroll_rules_technician_user_id_fkey FOREIGN KEY (technician_user_id) REFERENCES public.users(id);


--
-- Name: payroll_summaries payroll_summaries_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_summaries
    ADD CONSTRAINT payroll_summaries_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.users(id);


--
-- Name: payroll_summaries payroll_summaries_payroll_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_summaries
    ADD CONSTRAINT payroll_summaries_payroll_cycle_id_fkey FOREIGN KEY (payroll_cycle_id) REFERENCES public.payroll_cycles(id) ON DELETE CASCADE;


--
-- Name: payroll_summaries payroll_summaries_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_summaries
    ADD CONSTRAINT payroll_summaries_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: payroll_summaries payroll_summaries_technician_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.payroll_summaries
    ADD CONSTRAINT payroll_summaries_technician_user_id_fkey FOREIGN KEY (technician_user_id) REFERENCES public.users(id);


--
-- Name: rooms rooms_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: service_items service_items_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.service_items
    ADD CONSTRAINT service_items_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: shop_join_applications shop_join_applications_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.shop_join_applications
    ADD CONSTRAINT shop_join_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: shop_join_applications shop_join_applications_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.shop_join_applications
    ADD CONSTRAINT shop_join_applications_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: shop_join_applications shop_join_applications_technician_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.shop_join_applications
    ADD CONSTRAINT shop_join_applications_technician_user_id_fkey FOREIGN KEY (technician_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: shop_staff_memberships shop_staff_memberships_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.shop_staff_memberships
    ADD CONSTRAINT shop_staff_memberships_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: shop_staff_memberships shop_staff_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.shop_staff_memberships
    ADD CONSTRAINT shop_staff_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: shops shops_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id);


--
-- Name: technician_profiles technician_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.technician_profiles
    ADD CONSTRAINT technician_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: technician_work_status_logs technician_work_status_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.technician_work_status_logs
    ADD CONSTRAINT technician_work_status_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: technician_work_status_logs technician_work_status_logs_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.technician_work_status_logs
    ADD CONSTRAINT technician_work_status_logs_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: technician_work_status_logs technician_work_status_logs_technician_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.technician_work_status_logs
    ADD CONSTRAINT technician_work_status_logs_technician_user_id_fkey FOREIGN KEY (technician_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_refresh_tokens user_refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: zubao_user
--

ALTER TABLE ONLY public.user_refresh_tokens
    ADD CONSTRAINT user_refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict rejhPBj414isvN0hTXSaBGTY1pq689wl9f8BseBOR230Rt9hXPVwaLuS2ev8gCj

