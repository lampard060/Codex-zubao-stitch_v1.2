truncate table payroll_order_items restart identity cascade;
truncate table payroll_summaries restart identity cascade;
truncate table payroll_cycles restart identity cascade;
truncate table payroll_rules restart identity cascade;
truncate table technician_work_status_logs restart identity cascade;
truncate table orders restart identity cascade;
truncate table service_items restart identity cascade;
truncate table shop_join_applications restart identity cascade;
truncate table shop_staff_memberships restart identity cascade;
truncate table shops restart identity cascade;
truncate table technician_profiles restart identity cascade;
truncate table merchant_profiles restart identity cascade;
truncate table users restart identity cascade;

insert into users (id, role, phone, password_hash)
values
  ('10000000-0000-0000-0000-000000000001', 'merchant', '13800000001', 'scrypt$ab5247ae9c7c8b0a7598ab4d9465bc5b$6f3841b2a3a16368dab0ccf6c41e8bf38cc5f8b1e072fc49b3f0ea964e4760fcf8f42c10dcf325c509cf48cdd74743eb71bca6ba4d73dd3698d81f668e7699ec'),
  ('20000000-0000-0000-0000-000000000001', 'technician', '13800000011', 'scrypt$ab5247ae9c7c8b0a7598ab4d9465bc5b$6f3841b2a3a16368dab0ccf6c41e8bf38cc5f8b1e072fc49b3f0ea964e4760fcf8f42c10dcf325c509cf48cdd74743eb71bca6ba4d73dd3698d81f668e7699ec'),
  ('20000000-0000-0000-0000-000000000002', 'technician', '13800000012', 'scrypt$ab5247ae9c7c8b0a7598ab4d9465bc5b$6f3841b2a3a16368dab0ccf6c41e8bf38cc5f8b1e072fc49b3f0ea964e4760fcf8f42c10dcf325c509cf48cdd74743eb71bca6ba4d73dd3698d81f668e7699ec'),
  ('20000000-0000-0000-0000-000000000003', 'technician', '13800000013', 'scrypt$ab5247ae9c7c8b0a7598ab4d9465bc5b$6f3841b2a3a16368dab0ccf6c41e8bf38cc5f8b1e072fc49b3f0ea964e4760fcf8f42c10dcf325c509cf48cdd74743eb71bca6ba4d73dd3698d81f668e7699ec'),
  ('20000000-0000-0000-0000-000000000004', 'technician', '13800000014', 'scrypt$ab5247ae9c7c8b0a7598ab4d9465bc5b$6f3841b2a3a16368dab0ccf6c41e8bf38cc5f8b1e072fc49b3f0ea964e4760fcf8f42c10dcf325c509cf48cdd74743eb71bca6ba4d73dd3698d81f668e7699ec'),
  ('20000000-0000-0000-0000-000000000005', 'technician', '13800000015', 'scrypt$ab5247ae9c7c8b0a7598ab4d9465bc5b$6f3841b2a3a16368dab0ccf6c41e8bf38cc5f8b1e072fc49b3f0ea964e4760fcf8f42c10dcf325c509cf48cdd74743eb71bca6ba4d73dd3698d81f668e7699ec');

insert into merchant_profiles (user_id, display_name)
values
  ('10000000-0000-0000-0000-000000000001', 'Frank Zhang');

insert into technician_profiles (user_id, name, avatar_url, bio, specialties, years_experience)
values
  ('20000000-0000-0000-0000-000000000001', '林婉儿', '/images/technician-lin.png', '擅长足底按摩与经络调理。', '["足底按摩", "中医经络推拿"]', 6),
  ('20000000-0000-0000-0000-000000000002', '张子墨', '/images/technician-zhang.png', '擅长肩颈放松与精油护理。', '["肩颈放松", "精油护理"]', 5),
  ('20000000-0000-0000-0000-000000000003', '沈清秋', '/images/technician-shen.png', '擅长调理型项目与深层放松。', '["中式推拿", "调理护理"]', 7),
  ('20000000-0000-0000-0000-000000000004', '王大志', '/images/technician-wang.png', '擅长快捷上钟和足疗标准服务。', '["标准足疗", "快速上钟"]', 4),
  ('20000000-0000-0000-0000-000000000005', '阿珍', '/images/technician-a-zhen.png', '等待审核加入门店。', '["精油开背"]', 3);

insert into shops (
  id,
  owner_user_id,
  name,
  manager_name,
  contact_phone,
  address,
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
  'professional',
  'active',
  now() + interval '180 days'
);

insert into shop_staff_memberships (shop_id, user_id, role_in_shop, membership_status, joined_at)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'merchant_owner', 'active', now() - interval '180 days'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'technician', 'active', now() - interval '120 days'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'technician', 'active', now() - interval '90 days'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'technician', 'active', now() - interval '80 days'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'technician', 'active', now() - interval '60 days');

insert into shop_join_applications (id, shop_id, technician_user_id, status, applied_at)
values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', 'pending', now() - interval '2 days');

insert into service_items (id, shop_id, name, service_mode, list_price, duration_minutes)
values
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '足底按摩', 'scheduled', 29800, 60),
  ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '中医经络推拿', 'designated', 36800, 75),
  ('50000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '肩颈舒缓护理', 'scheduled', 26800, 50);

insert into technician_work_status_logs (shop_id, technician_user_id, attendance_status, service_status, changed_by, changed_at)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'on_duty', 'available', '10000000-0000-0000-0000-000000000001', now() - interval '20 minutes'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'on_duty', 'in_service', '10000000-0000-0000-0000-000000000001', now() - interval '10 minutes'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'on_duty', 'available', '10000000-0000-0000-0000-000000000001', now() - interval '8 minutes'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'off_duty', 'resting', '10000000-0000-0000-0000-000000000001', now() - interval '30 minutes');

insert into orders (
  id,
  shop_id,
  technician_user_id,
  service_item_id,
  order_no,
  order_type,
  status,
  room_code,
  customer_name,
  start_time,
  end_time,
  service_amount,
  actual_amount,
  note,
  created_by
)
values
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '#ZB-8921', 'scheduled', 'completed', 'SPA-01', '李女士', now() - interval '3 days', now() - interval '3 days' + interval '60 minutes', 29800, 29800, null, '10000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '#ZB-8920', 'designated', 'completed', 'SPA-03', '张先生', now() - interval '2 days', now() - interval '2 days' + interval '75 minutes', 36800, 36800, null, '10000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', '#ZB-8919', 'scheduled', 'completed', 'SPA-02', '陈女士', now() - interval '1 day', now() - interval '1 day' + interval '50 minutes', 26800, 26800, null, '10000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '#ZB-8918', 'designated', 'completed', 'SPA-05', '赵女士', now() - interval '6 hours', now() - interval '4 hours', 36800, 36800, null, '10000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '#ZB-8922', 'scheduled', 'in_service', 'SPA-06', '孙女士', now() - interval '30 minutes', null, 29800, 29800, null, '10000000-0000-0000-0000-000000000001');

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
  ('70000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'shop_default', null, 300000, 0.35, 0.45, 8000, current_date - interval '30 days', true),
  ('70000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'technician_override', '20000000-0000-0000-0000-000000000002', 320000, 0.35, 0.45, 8800, current_date - interval '30 days', true);

insert into payroll_cycles (id, shop_id, cycle_month, status, started_at, created_by)
values
  ('80000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', date_trunc('month', current_date)::date, 'reviewing', now() - interval '1 day', '10000000-0000-0000-0000-000000000001');

insert into payroll_summaries (
  id,
  payroll_cycle_id,
  shop_id,
  technician_user_id,
  rule_snapshot,
  completed_order_count,
  scheduled_amount_total,
  designated_amount_total,
  scheduled_commission_amount,
  designated_commission_amount,
  designated_bonus_total,
  base_salary_amount,
  gross_salary_amount,
  payment_status
)
values
  ('90000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '{"base_salary":300000,"scheduled_commission_rate":0.35,"designated_commission_rate":0.45,"designated_bonus_amount":8000}', 2, 29800, 36800, 10430, 16560, 8000, 300000, 334990, 'pending'),
  ('90000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '{"base_salary":320000,"scheduled_commission_rate":0.35,"designated_commission_rate":0.45,"designated_bonus_amount":8800}', 1, 0, 36800, 0, 16560, 8800, 320000, 345360, 'paid'),
  ('90000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '{"base_salary":300000,"scheduled_commission_rate":0.35,"designated_commission_rate":0.45,"designated_bonus_amount":8000}', 1, 26800, 0, 9380, 0, 0, 300000, 309380, 'pending');

insert into payroll_order_items (
  payroll_summary_id,
  order_id,
  order_type,
  service_amount,
  commission_rate,
  commission_amount,
  designated_bonus_amount,
  included_in_salary
)
values
  ('90000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'scheduled', 29800, 0.35, 10430, 0, true),
  ('90000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000004', 'designated', 36800, 0.45, 16560, 8000, true),
  ('90000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', 'designated', 36800, 0.45, 16560, 8800, true),
  ('90000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003', 'scheduled', 26800, 0.35, 9380, 0, true);
