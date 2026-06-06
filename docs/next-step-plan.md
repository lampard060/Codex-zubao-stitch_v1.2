# 足宝开发下一步计划

> 基于 docs/project-logic.md、docs/mvp-backend-design.md、docs/technical-architecture.md、zubao_wellness_elite/DESIGN.md 以及当前项目实际代码状态整理（第二次修订）

---

## 一、项目当前状态总览（修订版）

经过全面检查，项目前端并非缺失，而是**完整实现**的。以下是真实状态：

### 已完成

| 模块 | 状态 | 说明 |
|------|------|------|
| **后端 API** | ✅ **完成** | 认证、商家端、技师端、订单、工资、基础数据等全部 7 个路由模块 |
| **数据库 Schema** | ✅ **完成** | 13 张表 + 枚举类型 + 索引 + 唯一约束（不含外键会导致 pg 警告处） |
| **种子数据** | ✅ **完成** | `mvp_seed.sql`（基础）+ `mvp_demo_seed.sql`（5 技师 + 订单 + 工资快照）|
| **前端样式** | ✅ **完成** | `app/styles.css` — 完整的 CSS 设计系统（CSS 变量、布局、组件、动画） |
| **前端 JS 入口** | ✅ **完成** | `app/js/main.js` — 动态页面加载 + `data-page` 属性驱动 |
| **前端 API 层** | ✅ **完成** | `app/js/utils/api.js` — fetch 封装 + 自动 Token 刷新 + 统一错误处理 |
| **前端会话层** | ✅ **完成** | `app/js/utils/session.js` — localStorage Token 管理 + 路由保护 |
| **前端工具层** | ✅ **完成** | `app/js/utils/dom.js`、`format.js`、`pwa.js` |
| **登录页** | ✅ **完成** | `app/js/pages/login.js` — 商家/技师角色切换，登录/登出，Session 检测 |
| **商家工作台** | ✅ **完成** | `app/js/pages/merchant-dashboard.js` — 实时营收、订单、待钟、新增上钟 |
| **订单管理** | ✅ **完成** | `app/js/pages/merchant-orders.js` — 列表、筛选、完成/取消操作 |
| **技师管理** | ✅ **完成** | `app/js/pages/merchant-technicians.js` — 列表、状态切换、申请审核 |
| **经营统计** | ✅ **完成** | `app/js/pages/merchant-analytics.js` — 周/月/年趋势、收入支出结构 |
| **工资模块** | ✅ **完成** | `merchant-payroll.js` + `merchant-payroll-detail.js` — 规则、汇总、明细、发薪 |
| **门店设置** | ✅ **完成** | `merchant-settings.js` — 门店信息编辑 |
| **基础数据** | ✅ **完成** | `merchant-services.js`、`merchant-rooms.js`、`merchant-members.js` 等 CRUD |
| **技师工作台** | ✅ **完成** | `technician-home.js` — 状态切换、门店信息、收益概览 |
| **技师收益** | ✅ **完成** | `technician-earnings.js` — 收益趋势 + 明细 |
| **技师资料** | ✅ **完成** | `technician-profile.js` — 资料编辑 |
| **技师申请** | ✅ **完成** | `technician-join-shop.js` — 申请加入门店流程 |
| **设计文档** | ✅ **完成** | 技术架构、项目逻辑、MVP 设计、设计规范 |

### 待补充

| 模块 | 状态 | 说明 |
|------|------|------|
| **数据库执行脚本** | ⚠️ 缺失 | `api-server/scripts/` 目录不存在，`package.json` 中的 `npm run db:*` 命令不可直接用 |
| **冒烟测试** | ⚠️ 缺失 | `package.json` 中的 `npm run smoke` 引用 `scripts/smoke-test.js`，但文件不存在 |
| **项目配置** | ⚠️ 缺失 | 无 `.gitignore`、`README.md` |
| **消费者端** | ❌ 未开始 | 按文档安排 Phase 3 |
| **分页支持** | ⚠️ 有限 | 订单/技师列表默认 limit 50，无翻页 |

---

## 二、实际需要做的事

项目已经非常接近 MVP 可运行状态。以下是真正的下一步工作优先级：

### 第一组：让项目跑起来（P0 — 半天）

```
预估：2-3 小时
```

#### 1. 安装 PostgreSQL + 建库建表

```bash
# 创建数据库和用户
createdb zubao
createuser zubao_user -P
# 直接通过 psql 执行 SQL
psql -U zubao_user -d zubao -f db/mvp_schema.sql
psql -U zubao_user -d zubao -f db/add_refresh_tokens.sql
psql -U zubao_user -d zubao -f db/mvp_demo_seed.sql
```

#### 2. 配置后端环境

- 复制 `api-server/.env.example` 为 `api-server/.env`，填入正确的 `DATABASE_URL` 和 `JWT_SECRET`
- `cd api-server && npm install`
- `npm run dev` 启动，验证 `GET /api/v1/health` 返回正常

#### 3. 启动前端

```bash
# 方式一：直接用浏览器打开
open app/login.html

# 方式二：用 VS Code Live Server 或 python http.server
cd app && python3 -m http.server 8080
# 然后访问 http://localhost:8080/login.html
```

API 地址自动解析逻辑（`session.js` 中的 `resolveApiBaseUrl`）：
- 默认连接 `http://localhost:3001/api/v1`
- 可通过 URL 参数 `?apiBase=http://your-server:3001` 覆盖
- 或者通过 `localStorage` 的 `zubao_api_base_url` 键覆盖

---

### 第二组：修复缺失的 npm scripts（P1 — 1-2 小时）

#### 4. 创建 `api-server/scripts/run-sql-file.js`

让 `npm run db:schema`、`npm run db:seed` 等命令可直接使用。

#### 5. 创建 `api-server/scripts/smoke-test.js`

让 `npm run smoke` 可以执行基本冒烟测试（登录 → 商家 dashboard → 技师端 API 调用）。

---

### 第三组：完善与收尾（P2 — 2-3 天）

#### 6. 添加 `.gitignore`

排除 `node_modules/`、`.env`、`*.log`、操作系统文件。

#### 7. 全流程走通验证

- 商家端：登录 → 工作台 → 新增上钟 → 完成上钟 → 查看统计 → 工资核算 → 发薪
- 技师端：登录 → 工作台状态切换 → 查看收益 → 编辑资料

#### 8. （可选）消费者端入口

开始在 `app/index.html` 上构建消费者端页面，或补充预约/评价相关的业务设计。

---

## 三、一次启动完整流程

```bash
# 1. 数据库（如有 PostgreSQL 运行中）
psql -U postgres -c "CREATE DATABASE zubao;"
psql -U postgres -d zubao -f db/mvp_schema.sql
psql -U postgres -d zubao -f db/add_refresh_tokens.sql
psql -U postgres -d zubao -f db/mvp_demo_seed.sql

# 2. 后端
cd api-server
cp .env.example .env   # 编辑 .env 中的 DATABASE_URL
npm install
npm run dev            # → http://localhost:3001

# 3. 前端（新开终端）
cd app
python3 -m http.server 8080
# → 浏览器打开 http://localhost:8080/login.html
```

**演示账号：**
| 角色 | 手机号 | 密码 |
|------|--------|------|
| 商家 | 13800000001 | 见 seed 文件中的 scrypt hash |
| 技师 1 (林婉儿) | 13800000011 | 同上 |
| 技师 2 (张子墨) | 13800000012 | 同上 |

> 注意：seed 中的密码是 scrypt 哈希。如果需要知道明文字段，可以在本地登录时用 API 测试，或添加一个注册 API 后设置新密码。

---

## 四、总结

项目实际上已经**非常接近可交付的 MVP 状态**：

- **后端 ✅** — API 完整，数据库设计良好，权限控制到位
- **前端 ✅** — 19 个 HTML 页面 + 完整 CSS 设计系统 + 模块化 JS（动态加载、API 客户端、页面逻辑全部就绪）
- **文档 ✅** — 技术架构、MVP 设计、项目逻辑、设计规范全部到位

**真正要做的事：** 配置 PostgreSQL、执行 SQL 建表、启动服务，项目就能跑起来。

如果需要我帮您做某一步的具体工作（比如创建 `scripts/` 目录下的缺失文件、编写快速启动说明、或做代码审查），随时告诉我。
