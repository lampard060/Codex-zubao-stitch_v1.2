# ZuBao API Server

## 快速启动（3 分钟）

前置条件：Node >= 22, PostgreSQL 运行中

```bash
# 1. 创建数据库
createdb zubao
createuser zubao_user -P   # 输入密码，如 zubao123

# 2. 配置环境变量（修改 DATABASE_URL 中的密码）
cp .env.example .env
# 编辑 .env: DATABASE_URL=postgresql://zubao_user:zubao123@127.0.0.1:5432/zubao

# 3. 安装依赖 + 建表 + 种子数据
npm install
npm run db:schema
npm run db:upgrade
npm run db:seed          # 基线数据

# 4. 启动服务
npm run dev              # → http://localhost:3001

# 5. 验证
curl http://localhost:3001/api/v1/health
```

**演示账号**（密码在 seed 中为 scrypt 哈希，登录时会验证）：
- 商家：13800000001
- 技师：13800000011 ~ 13800000015

**启动前端**（新开终端）：
```bash
cd app
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080/login.html
```

---

## 当前状态

当前目录提供足宝 MVP 的 API 骨架，覆盖：

- 健康检查
- 认证路由占位
- 商家首页 / 统计 / 设置
- 技师管理 / 门店申请
- 订单
- 工资

当前已完成第一批真实 SQL 读接口：

- 项目结构
- 环境变量
- PostgreSQL 连接层
- 商家首页 / 统计 / 设置读取
- 技师列表 / 申请记录读取
- 订单列表读取
- 工资总览 / 规则 / 汇总 / 明细读取
- 技师工作台 / 收益 / 资料 / 门店关系读取

## 使用方式

1. 安装依赖

```bash
npm install
```

2. 创建环境变量

```bash
cp .env.example .env
```

3. 启动开发

```bash
npm run dev
```

4. 健康检查

```bash
GET /api/v1/health
```

5. 创建环境变量文件

```bash
cp .env.example .env
```

6. 导入库表

```bash
npm run db:schema
```

7. 执行升级脚本

```bash
npm run db:upgrade
```

其中会包含：

- `db:upgrade:masterdata`
- `db:upgrade:refresh-tokens`

8. 导入测试基线数据

```bash
npm run db:seed
```

当前默认 `db/mvp_seed.sql` 已改为“上线前空白基线”。

- 会保留最小账号、门店、技师资料和默认工资规则
- 会清空订单、工资汇总、申请记录等业务演示数据

如需恢复原来的演示数据，可使用：

```bash
node scripts/run-sql-file.js ../db/mvp_demo_seed.sql
```

9. 请求上下文与鉴权

当前接口已接入 Bearer token 登录态，服务端会优先使用已认证用户身份。

- 商家端请求需要携带有效 token，并继续提供 `x-shop-id` 或 `?shopId=` 指定门店
- `x-user-id` 在已登录场景下会被服务端忽略，不再允许伪造操作者身份
- 技师端接口会强制绑定当前登录技师本人，不再信任外部传入的 `technicianUserId`

开发调试时，仍可通过 header 或 query 传补充上下文：

- 商家端：
  - `x-shop-id`
  - `x-user-id`
- 技师端：
  - `x-technician-user-id`

例如：

```bash
curl "http://localhost:3001/api/v1/merchant/dashboard?shopId=30000000-0000-0000-0000-000000000001"
```

```bash
curl "http://localhost:3001/api/v1/technician/home?technicianUserId=20000000-0000-0000-0000-000000000001"
```

10. 种子账号

- 默认密码：`Zubao123!`
- 商家账号：`13800000001`
- 技师账号：`13800000011`

11. 当前已完成的真实写接口

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `PATCH /api/v1/merchant/technicians/:technicianUserId/status`
- `POST /api/v1/merchant/technician-applications/:applicationId/approve`
- `POST /api/v1/merchant/technician-applications/:applicationId/reject`
- `POST /api/v1/technician/shop-applications`
- `POST /api/v1/merchant/orders`
- `PATCH /api/v1/merchant/orders/:orderId`
- `PATCH /api/v1/merchant/orders/:orderId/complete`
- `PUT /api/v1/merchant/payroll/rules/default`
- `PUT /api/v1/merchant/payroll/rules/technicians/:technicianUserId`
- `POST /api/v1/merchant/payroll/cycles/:cycleId/recalculate`
- `POST /api/v1/merchant/payroll/summaries/:summaryId/mark-paid`

12. 常用烟测

```bash
npm run smoke
```

13. 常用调试示例

```bash
curl -X POST "http://localhost:3001/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800000001","password":"Zubao123!"}'
```

```bash
curl "http://localhost:3001/api/v1/auth/me" \
  -H "Authorization: Bearer <token>"
```

```bash
curl "http://localhost:3001/api/v1/merchant/orders" \
  -H "Authorization: Bearer <token>" \
  -H "x-shop-id: 30000000-0000-0000-0000-000000000001"
```

## 下一步开发建议

1. 增加鉴权中间件与 JWT 登录
2. 把 `POST /merchant/orders`、`PATCH /merchant/orders/:id/complete` 接成真实写接口
3. 实现工资重算与发放动作
4. 给前端拆出共享 `api-client`
