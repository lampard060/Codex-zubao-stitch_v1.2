create table if not exists shop_leave_applications (
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

create unique index if not exists uq_pending_leave_application_per_shop_technician
on shop_leave_applications (shop_id, technician_user_id)
where status = 'pending';
