do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'customer_type'
  ) then
    create type customer_type as enum ('registered', 'walk_in');
  end if;
end $$;

alter table service_items
  add column if not exists description text;

create table if not exists rooms (
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

create table if not exists customers (
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

create index if not exists idx_customers_shop_active_name on customers(shop_id, is_active, name asc);

alter table orders
  add column if not exists room_id uuid references rooms(id),
  add column if not exists customer_id uuid references customers(id),
  add column if not exists customer_type customer_type not null default 'walk_in';

