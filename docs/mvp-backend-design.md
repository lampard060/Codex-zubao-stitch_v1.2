# 足宝 MVP 数据库与 API 设计

## 1. 设计范围

本设计只覆盖 Phase 1 MVP，目标是支撑当前已经完成的页面与业务流程：

- 商家登录与门店管理
- 技师独立账号与资料维护
- 技师申请加入门店
- 单门店签约关系
- 上钟订单录入、完成、查询
- 商家经营统计
- 工资规则、工资周期、工资复核

暂不进入本版设计：

- 跨店借调
- 消费者预约
- 多门店集团化权限
- 在线支付
- 消息通知中心

## 2. 核心业务约束

### 2.1 角色

- `merchant`：商家/店长/老板
- `technician`：技师

### 2.2 门店与技师关系

- 技师拥有独立账号
- 技师同一时间只能签约一家门店
- 商家不能修改技师个人资料
- 技师可申请加入门店，商家审核后建立签约关系
- 技师解约后才可重新申请其他门店

### 2.3 订单

- 每笔订单归属唯一门店
- 每笔订单归属唯一技师
- 订单状态只保留 MVP 必需值：`in_service`、`completed`、`cancelled`
- 只有 `completed` 订单参与工资计算

### 2.4 工资

- 工资按月结算，使用 `payroll_cycles`
- 每家门店有默认工资规则
- 技师可有单独覆盖规则
- 工资计算以订单快照为准，避免后续订单修改影响历史工资

## 3. 数据库表

### 3.1 `users`

统一账号表。

关键字段：

- `id`
- `role`
- `phone`
- `password_hash`
- `status`
- `last_login_at`

说明：

- 先不拆外部认证，MVP 直接账号密码登录
- `phone` 全局唯一

### 3.2 `merchant_profiles`

商家资料表，一对一关联 `users`。

关键字段：

- `user_id`
- `display_name`

### 3.3 `technician_profiles`

技师资料表，一对一关联 `users`。

关键字段：

- `user_id`
- `name`
- `avatar_url`
- `bio`
- `specialties`
- `years_experience`

说明：

- `specialties` 用 `jsonb`
- 后面如果标签体系复杂，再拆子表

### 3.4 `shops`

门店表。

关键字段：

- `id`
- `name`
- `owner_user_id`
- `manager_name`
- `contact_phone`
- `address`
- `qr_code_url`
- `subscription_plan`
- `subscription_status`
- `subscription_expires_at`

说明：

- MVP 允许一个商家拥有一家门店即可
- 如果后面做一商家多门店，只需在这里扩展

### 3.5 `shop_staff_memberships`

门店人员关系表，统一存商家与技师的门店归属关系。

关键字段：

- `shop_id`
- `user_id`
- `role_in_shop`
- `membership_status`
- `joined_at`
- `left_at`

说明：

- 商家本人也在这张表里留一条 `merchant_owner` 记录
- 技师签约中时 `membership_status = active`

### 3.6 `shop_join_applications`

技师加入门店申请表。

关键字段：

- `shop_id`
- `technician_user_id`
- `status`
- `applied_at`
- `reviewed_at`
- `reviewed_by`
- `review_note`

说明：

- 一个技师对同一门店同一时间只能有一条 `pending` 申请

### 3.7 `service_items`

服务项目表。

关键字段：

- `shop_id`
- `name`
- `service_mode`
- `list_price`
- `duration_minutes`
- `is_active`

说明：

- `service_mode`：`scheduled`（排钟）/ `designated`（点钟）
- 价格可在订单落单时再覆盖

### 3.8 `orders`

订单主表。

关键字段：

- `shop_id`
- `technician_user_id`
- `service_item_id`
- `order_no`
- `order_type`
- `status`
- `room_code`
- `customer_name`
- `start_time`
- `end_time`
- `service_amount`
- `actual_amount`
- `note`
- `created_by`

说明：

- `order_type` 保留 `scheduled` / `designated`
- `service_amount` 用于工资计算基数
- `actual_amount` 给后面接营销折扣留余地

### 3.9 `technician_work_status_logs`

技师在店状态日志。

关键字段：

- `shop_id`
- `technician_user_id`
- `attendance_status`
- `service_status`
- `changed_by`
- `changed_at`

说明：

- 当前状态页可以从最后一条日志反推
- MVP 也可以后续增加一张 current 状态表做缓存

### 3.10 `payroll_rules`

工资规则表。

关键字段：

- `shop_id`
- `scope_type`
- `technician_user_id`
- `base_salary`
- `scheduled_commission_rate`
- `designated_commission_rate`
- `designated_bonus_amount`
- `effective_from`
- `effective_to`
- `is_active`

说明：

- `scope_type = shop_default` 表示门店默认规则
- `scope_type = technician_override` 表示技师覆盖规则

### 3.11 `payroll_cycles`

工资周期表。

关键字段：

- `shop_id`
- `cycle_month`
- `status`
- `started_at`
- `closed_at`
- `paid_at`

说明：

- `cycle_month` 统一用当月第一天表示，例如 `2026-04-01`

### 3.12 `payroll_summaries`

每个工资周期、每位技师的工资汇总。

关键字段：

- `payroll_cycle_id`
- `shop_id`
- `technician_user_id`
- `rule_snapshot`
- `completed_order_count`
- `scheduled_amount_total`
- `designated_amount_total`
- `scheduled_commission_amount`
- `designated_commission_amount`
- `designated_bonus_total`
- `base_salary_amount`
- `gross_salary_amount`
- `payment_status`
- `paid_at`
- `paid_by`

说明：

- `rule_snapshot` 用 `jsonb` 存当时规则
- 发薪后这张表就是商家看到的工资总表

### 3.13 `payroll_order_items`

工资明细按订单拆分表。

关键字段：

- `payroll_summary_id`
- `order_id`
- `order_type`
- `service_amount`
- `commission_rate`
- `commission_amount`
- `designated_bonus_amount`
- `included_in_salary`

说明：

- 用于工资页逐笔复核

## 4. 推荐枚举

### 4.1 用户

- `user_role`：`merchant`、`technician`
- `user_status`：`active`、`disabled`

### 4.2 门店关系

- `shop_role_in_membership`：`merchant_owner`、`merchant_manager`、`technician`
- `membership_status`：`pending`、`active`、`left`、`removed`

### 4.3 申请

- `application_status`：`pending`、`approved`、`rejected`、`cancelled`

### 4.4 订单

- `order_type`：`scheduled`、`designated`
- `order_status`：`in_service`、`completed`、`cancelled`

### 4.5 技师状态

- `attendance_status`：`on_duty`、`off_duty`、`resting`
- `service_status`：`available`、`in_service`、`resting`

### 4.6 工资

- `payroll_scope_type`：`shop_default`、`technician_override`
- `payroll_cycle_status`：`draft`、`reviewing`、`paid`
- `payment_status`：`pending`、`paid`

## 5. API 设计

## 5.1 认证

### `POST /api/v1/auth/login`

用途：账号密码登录

请求体：

```json
{
  "phone": "13800000000",
  "password": "******"
}
```

响应：

```json
{
  "token": "jwt-token",
  "user": {
    "id": "uuid",
    "role": "merchant"
  }
}
```

### `GET /api/v1/auth/me`

用途：获取当前登录用户和角色信息

## 5.2 商家端

### `GET /api/v1/merchant/dashboard`

用途：商家首页

返回：

- 今日订单数
- 今日营收
- 在岗技师数
- 进行中订单
- 待钟技师
- 技师排行榜

### `GET /api/v1/merchant/analytics`

用途：经营统计页

返回：

- 营业收入
- 工资支出
- 净营收
- 阶段趋势
- 工资摘要
- 技师贡献排行

支持查询参数：

- `period=this_month`
- `period=this_year`
- `period=custom&start_date=2026-04-01&end_date=2026-04-30`

### `GET /api/v1/merchant/settings`

用途：门店设置页信息

### `PUT /api/v1/merchant/settings`

用途：更新门店信息

## 5.3 技师管理

### `GET /api/v1/merchant/technicians`

用途：商家查看技师列表

支持筛选：

- `attendance_status`
- `service_status`

### `PATCH /api/v1/merchant/technicians/:technicianUserId/status`

用途：修改技师状态

请求体：

```json
{
  "attendance_status": "on_duty",
  "service_status": "available"
}
```

### `GET /api/v1/merchant/technician-applications`

用途：查看技师加入申请

### `POST /api/v1/merchant/technician-applications/:applicationId/approve`

用途：通过申请并建立门店关系

### `POST /api/v1/merchant/technician-applications/:applicationId/reject`

用途：拒绝申请

## 5.4 订单

### `GET /api/v1/merchant/orders`

用途：订单列表

支持筛选：

- `date`
- `status`
- `technician_user_id`
- `keyword`

### `POST /api/v1/merchant/orders`

用途：新增上钟

请求体：

```json
{
  "technician_user_id": "uuid",
  "service_item_id": "uuid",
  "order_type": "designated",
  "room_code": "V108",
  "customer_name": "张先生",
  "start_time": "2026-04-07T13:30:00+08:00",
  "service_amount": 39800,
  "actual_amount": 39800,
  "note": ""
}
```

说明：

- 金额统一建议用“分”为单位存整数

### `PATCH /api/v1/merchant/orders/:orderId/complete`

用途：结束上钟，订单状态改为 `completed`

### `PATCH /api/v1/merchant/orders/:orderId`

用途：修改订单基础信息

## 5.5 工资

### `GET /api/v1/merchant/payroll/overview`

用途：工资页顶部概览

返回：

- 本月工资总额
- 核算人数
- 平均薪资
- 已发 / 未发

### `GET /api/v1/merchant/payroll/rules`

用途：查看当前工资规则

### `PUT /api/v1/merchant/payroll/rules/default`

用途：更新门店默认规则

### `PUT /api/v1/merchant/payroll/rules/technicians/:technicianUserId`

用途：设置技师单独规则

### `GET /api/v1/merchant/payroll/summaries`

用途：工资总表

支持参数：

- `cycle_month=2026-04-01`
- `payment_status=pending|paid`
- `keyword`

### `POST /api/v1/merchant/payroll/cycles/:cycleId/recalculate`

用途：按已完成订单重新生成工资汇总

### `POST /api/v1/merchant/payroll/summaries/:summaryId/mark-paid`

用途：标记单个技师工资已发放

### `GET /api/v1/merchant/payroll/summaries/:summaryId/items`

用途：查看工资订单明细

## 5.6 技师端

### `GET /api/v1/technician/home`

用途：技师工作台

返回：

- 当前门店
- 当前状态
- 本月收入
- 最近结算记录

### `GET /api/v1/technician/earnings`

用途：收益统计

### `GET /api/v1/technician/profile`

用途：查看个人资料

### `PUT /api/v1/technician/profile`

用途：更新个人资料

### `GET /api/v1/technician/membership`

用途：查看当前门店关系

### `POST /api/v1/technician/shop-applications`

用途：申请加入门店

请求体：

```json
{
  "shop_id": "uuid"
}
```

服务端校验：

- 当前没有 `active` 签约关系
- 当前对该门店没有 `pending` 申请

## 6. 推荐开发顺序

1. 建 `users / merchant_profiles / technician_profiles / shops`
2. 建 `shop_staff_memberships / shop_join_applications`
3. 建 `service_items / orders`
4. 建 `payroll_rules / payroll_cycles / payroll_summaries / payroll_order_items`
5. 先完成登录、技师管理、订单、工资总表 API
6. 最后补统计聚合接口

## 7. MVP 关键实现建议

- 金额统一使用整数分，避免浮点误差
- 头像、二维码、门店图片先存 URL，不做文件系统耦合
- 工资汇总采用“月度快照”而不是每次实时全量计算
- PostgreSQL 先不引入复杂 RLS，MVP 先在服务端做权限控制
- 高频查询字段提前建索引：`shop_id`、`technician_user_id`、`status`、`cycle_month`
