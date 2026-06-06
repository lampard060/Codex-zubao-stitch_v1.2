create extension if not exists "pgcrypto";

create type user_role as enum ('merchant', 'technician');
create type user_status as enum ('active', 'disabled');

create type shop_role_in_membership as enum ('merchant_owner', 'merchant_manager', 'technician');
create type membership_status as enum ('pending', 'active', 'left', 'removed');

create type application_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create type order_type as enum ('scheduled', 'designated');
create type order_status as enum ('pending', 'in_service', 'completed', 'cancelled');
create type customer_type as enum ('registered', 'walk_in');

create type attendance_status as enum ('on_duty', 'off_duty', 'resting');
create type service_status as enum ('available', 'in_service', 'resting');

create type payroll_scope_type as enum ('shop_default', 'technician_override');
create type payroll_cycle_status as enum ('draft', 'reviewing', 'paid');
create type payment_status as enum ('pending', 'paid');

create table users (
  id uuid primary key default gen_random_uuid(),
  role user_role not null,
  phone varchar(32) not null unique,
  password_hash text not null,
  status user_status not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table merchant_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  display_name varchar(100) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table technician_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  name varchar(100) not null,
  avatar_url text,
  bio text,
  specialties jsonb not null default '[]'::jsonb,
  years_experience integer not null default 0,
  gender varchar(10),
  birth_date date,
  id_card varchar(18),
  address text,
  emergency_contact_name varchar(100),
  emergency_contact_phone varchar(32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table shops (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id),
  name varchar(120) not null,
  manager_name varchar(100),
  contact_phone varchar(32),
  address text,
  qr_code_url text,
  opening_hours varchar(32),
  subscription_plan varchar(50) not null default 'trial',
  subscription_status varchar(50) not null default 'active',
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table shop_staff_memberships (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role_in_shop shop_role_in_membership not null,
  membership_status membership_status not null default 'active',
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, user_id)
);

create unique index uq_active_technician_membership
on shop_staff_memberships (user_id)
where role_in_shop = 'technician' and membership_status = 'active';

create table shop_join_applications (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  technician_user_id uuid not null references users(id) on delete cascade,
  status application_status not null default 'pending',
  applied_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references users(id),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uq_pending_application_per_shop_technician
on shop_join_applications (shop_id, technician_user_id)
where status = 'pending';

create table shop_leave_applications (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  technician_user_id uuid not null references users(id) on delete cascade,
  membership_id uuid references shop_staff_memberships(id) on delete set null,
  status application_status not null default 'pending',
  reason text,
  applied_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references users(id),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uq_pending_leave_application_per_shop_technician
on shop_leave_applications (shop_id, technician_user_id)
where status = 'pending';

create table service_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name varchar(120) not null,
  description text,
  service_mode order_type not null,
  list_price integer not null,
  duration_minutes integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name varchar(80) not null,
  room_type varchar(80),
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, name)
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name varchar(100) not null,
  phone varchar(32),
  gender varchar(20),
  note text,
  is_member boolean not null default false,
  is_active boolean not null default true,
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_customers_shop_active_name on customers(shop_id, is_active, name asc);

create table orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  technician_user_id uuid not null references users(id),
  service_item_id uuid references service_items(id),
  room_id uuid references rooms(id),
  customer_id uuid references customers(id),
  order_no varchar(50) not null unique,
  order_type order_type not null,
  status order_status not null default 'pending',
  customer_type customer_type not null default 'walk_in',
  room_code varchar(50),
  customer_name varchar(100),
  start_time timestamptz not null,
  end_time timestamptz,
  service_amount integer not null,
  actual_amount integer not null,
  note text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_shop_status_start_time on orders(shop_id, status, start_time desc);
create index idx_orders_shop_technician_start_time on orders(shop_id, technician_user_id, start_time desc);
create index idx_orders_completed_for_payroll on orders(shop_id, technician_user_id, end_time)
where status = 'completed';

create table technician_work_status_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  technician_user_id uuid not null references users(id) on delete cascade,
  attendance_status attendance_status not null,
  service_status service_status not null,
  changed_by uuid not null references users(id),
  changed_at timestamptz not null default now()
);

create index idx_work_status_latest on technician_work_status_logs(shop_id, technician_user_id, changed_at desc);

create table payroll_rules (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  scope_type payroll_scope_type not null,
  technician_user_id uuid references users(id),
  base_salary integer not null default 0,
  scheduled_commission_rate numeric(5,4) not null default 0,
  designated_commission_rate numeric(5,4) not null default 0,
  designated_bonus_amount integer not null default 0,
  effective_from date not null,
  effective_to date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope_type = 'shop_default' and technician_user_id is null) or
    (scope_type = 'technician_override' and technician_user_id is not null)
  )
);

create unique index uq_active_default_payroll_rule
on payroll_rules (shop_id)
where scope_type = 'shop_default' and is_active = true and effective_to is null;

create index idx_payroll_rules_override_lookup
on payroll_rules (shop_id, technician_user_id, effective_from desc)
where scope_type = 'technician_override' and is_active = true;

create table payroll_cycles (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  cycle_month date not null,
  status payroll_cycle_status not null default 'draft',
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  paid_at timestamptz,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, cycle_month)
);

create table payroll_summaries (
  id uuid primary key default gen_random_uuid(),
  payroll_cycle_id uuid not null references payroll_cycles(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  technician_user_id uuid not null references users(id),
  rule_snapshot jsonb not null,
  completed_order_count integer not null default 0,
  scheduled_amount_total integer not null default 0,
  designated_amount_total integer not null default 0,
  scheduled_commission_amount integer not null default 0,
  designated_commission_amount integer not null default 0,
  designated_bonus_total integer not null default 0,
  base_salary_amount integer not null default 0,
  gross_salary_amount integer not null default 0,
  payment_status payment_status not null default 'pending',
  paid_at timestamptz,
  paid_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_cycle_id, technician_user_id)
);

create index idx_payroll_summaries_cycle_payment on payroll_summaries(payroll_cycle_id, payment_status);
create index idx_payroll_summaries_shop_technician on payroll_summaries(shop_id, technician_user_id);

create table payroll_order_items (
  id uuid primary key default gen_random_uuid(),
  payroll_summary_id uuid not null references payroll_summaries(id) on delete cascade,
  order_id uuid not null references orders(id) on delete restrict,
  order_type order_type not null,
  service_amount integer not null,
  commission_rate numeric(5,4) not null default 0,
  commission_amount integer not null default 0,
  designated_bonus_amount integer not null default 0,
  included_in_salary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_summary_id, order_id)
);

create index idx_payroll_order_items_summary on payroll_order_items(payroll_summary_id);
