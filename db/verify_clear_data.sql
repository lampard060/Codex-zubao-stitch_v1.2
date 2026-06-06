-- 验证技师演示数据清空结果
SELECT 'shop_staff_memberships' as table_name, COUNT(*) as count 
FROM shop_staff_memberships 
WHERE user_id = '20000000-0000-0000-0000-000000000001';

SELECT 'shop_join_applications' as table_name, COUNT(*) as count 
FROM shop_join_applications 
WHERE technician_user_id = '20000000-0000-0000-0000-000000000001';

SELECT 'technician_work_status_logs' as table_name, COUNT(*) as count 
FROM technician_work_status_logs 
WHERE technician_user_id = '20000000-0000-0000-0000-000000000001';

SELECT 'orders' as table_name, COUNT(*) as count 
FROM orders 
WHERE technician_user_id = '20000000-0000-0000-0000-000000000001';

SELECT 'payroll_summaries' as table_name, COUNT(*) as count 
FROM payroll_summaries 
WHERE technician_user_id = '20000000-0000-0000-0000-000000000001';

-- 验证技师账号和资料仍然存在
SELECT 'users' as table_name, COUNT(*) as count 
FROM users 
WHERE phone = '13800000011';

SELECT 'technician_profiles' as table_name, COUNT(*) as count 
FROM technician_profiles 
WHERE user_id = '20000000-0000-0000-0000-000000000001';
