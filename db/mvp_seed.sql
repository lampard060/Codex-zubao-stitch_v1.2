truncate table payroll_order_items restart identity cascade;
truncate table payroll_summaries restart identity cascade;
truncate table payroll_cycles restart identity cascade;
truncate table payroll_rules restart identity cascade;
truncate table technician_work_status_logs restart identity cascade;
truncate table orders restart identity cascade;
truncate table customers restart identity cascade;
truncate table rooms restart identity cascade;
truncate table service_items restart identity cascade;
truncate table shop_join_applications restart identity cascade;
truncate table shop_staff_memberships restart identity cascade;
truncate table shops restart identity cascade;
truncate table technician_profiles restart identity cascade;
truncate table merchant_profiles restart identity cascade;
truncate table users restart identity cascade;

insert into users (id, role, phone, password_hash)
values
  ('10000000-0000-0000-0000-000000000001', 'merchant', '13800000001', 'scrypt$e337f958e62ca19999cb87e86e019986$c0b98b8607a17412205d8f45def4ca45030eeeb64d69d802f1ef63286e09787abe11e02e40e27085abe30060c93f8060acf4ca459b46cd9b04cc2a13ffe27031'),
  ('20000000-0000-0000-0000-000000000001', 'technician', '13800000011', 'scrypt$e337f958e62ca19999cb87e86e019986$c0b98b8607a17412205d8f45def4ca45030eeeb64d69d802f1ef63286e09787abe11e02e40e27085abe30060acf4ca459b46cd9b04cc2a13ffe27031'),
  ('20000000-0000-0000-0000-000000000002', 'technician', '13800000012', 'scrypt$e337f958e62ca19999cb87e86e019986$c0b98b8607a17412205d8f45def4ca45030eeeb64d69d802f1ef63286e09787abe11e02e40e27085abe30060acf4ca459b46cd9b04cc2a13ffe27031');

insert into merchant_profiles (user_id, display_name)
values
  ('10000000-0000-0000-0000-000000000001', 'Frank Zhang');

insert into technician_profiles (user_id, name, avatar_url, bio, specialties, years_experience)
values
  ('20000000-0000-0000-0000-000000000001', '林婉儿', null, '用于测试技师端工作台、收益与资料维护。', '["足底按摩", "中医经络推拿"]', 6),
  ('20000000-0000-0000-0000-000000000002', '周小雅', null, '用于测试未签约技师资料展示。', '["肩颈舒缓"]', 3);

insert into shops (
  id,
  owner_user_id,
  name,
  manager_name,
  contact_phone,
  address,
  opening_hours,
  subscription_plan,
  subscription_status,
  subscription_expires_at
)
values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '足宝旗舰店',
  'Frank Zhang',
  '021-88886666',
  '上海市浦东新区示例路 88 号',
  '10:00-22:00',
  'professional',
  'active',
  now() + interval '180 days'
);

insert into shop_staff_memberships (shop_id, user_id, role_in_shop, membership_status, joined_at)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'merchant_owner', 'active', now() - interval '180 days'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'technician', 'active', now() - interval '30 days');

insert into technician_work_status_logs (shop_id, technician_user_id, attendance_status, service_status, changed_by, changed_at)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'on_duty', 'available', '10000000-0000-0000-0000-000000000001', now() - interval '10 minutes');

insert into payroll_rules (
  id,
  shop_id,
  scope_type,
  technician_user_id,
  base_salary,
  scheduled_commission_rate,
  designated_commission_rate,
  designated_bonus_amount,
  effective_from,
  is_active
)
values
  ('70000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'shop_default', null, 300000, 0.35, 0.45, 8000, current_date - interval '30 days', true);
