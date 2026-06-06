-- 清空技师账号(13800000011 林婉儿)的演示数据
-- 注意: 保留技师基本资料(technician_profiles)和账号(users)

BEGIN;

-- 1. 获取技师用户ID
DO $$
DECLARE
  tech_user_id UUID;
BEGIN
  -- 查找技师用户ID
  SELECT id INTO tech_user_id
  FROM users
  WHERE phone = '13800000011';
  
  IF tech_user_id IS NULL THEN
    RAISE NOTICE '技师账号(13800000011)未找到';
    RETURN;
  END IF;
  
  RAISE NOTICE '找到技师用户ID: %', tech_user_id;
  
  -- 2. 删除工资订单明细 (通过payroll_summaries关联)
  DELETE FROM payroll_order_items 
  WHERE payroll_summary_id IN (
    SELECT id FROM payroll_summaries 
    WHERE technician_user_id = tech_user_id
  );
  RAISE NOTICE '已删除工资订单明细';
  
  -- 3. 删除工资汇总
  DELETE FROM payroll_summaries 
  WHERE technician_user_id = tech_user_id;
  RAISE NOTICE '已删除工资汇总';
  
  -- 4. 删除工资周期 (如果没有其他技师使用)
  DELETE FROM payroll_cycles 
  WHERE id NOT IN (
    SELECT DISTINCT payroll_cycle_id 
    FROM payroll_summaries
  );
  RAISE NOTICE '已删除空闲工资周期';
  
  -- 5. 删除技师相关的订单
  DELETE FROM orders 
  WHERE technician_user_id = tech_user_id;
  RAISE NOTICE '已删除技师订单';
  
  -- 6. 删除技师工作状态日志
  DELETE FROM technician_work_status_logs 
  WHERE technician_user_id = tech_user_id;
  RAISE NOTICE '已删除工作状态日志';
  
  -- 7. 删除门店签约关系 (使用user_id字段)
  DELETE FROM shop_staff_memberships 
  WHERE user_id = tech_user_id;
  RAISE NOTICE '已删除门店签约关系';
  
  -- 8. 删除店铺申请记录
  DELETE FROM shop_join_applications 
  WHERE technician_user_id = tech_user_id;
  RAISE NOTICE '已删除店铺申请记录';
  
  RAISE NOTICE '技师演示数据清空完成';
END $$;

COMMIT;
