# 足宝（ZuBao）产品需求文档 (PRD)

> **文档版本**: v1.0
> **最后更新**: 2026-05-10
> **文档状态**: MVP开发中
> **自动更新**: 每日16:00根据项目变动自动更新

---

## 1. 产品概述

### 1.1 产品定位

**足宝（ZuBao）** 是一款面向足疗/SPA门店的SaaS管理系统，连接商家（门店经营者）与技师（服务提供者），提供从技师管理、订单处理到工资结算的全流程数字化解决方案。

### 1.2 产品愿景

成为足疗行业最专业、最易用的门店管理工具，让商家省心、技师安心。

### 1.3 核心价值主张

- **商家端**：一个后台搞定技师管理、订单记录、经营统计、工资核算
- **技师端**：独立账号自主管理资料，随时查看收益与结算记录
- **数据驱动**：清晰的经营数据支撑决策，透明的工资规则减少纠纷

### 1.4 目标市场

- 中国足疗/SPA行业中小型门店（1-10家）
- 单店年营收50-500万的独立门店经营者
- 技师团队3-30人的服务场所

---

## 2. 用户角色

### 2.1 角色定义

| 角色 | 说明 | 使用场景 |
|------|------|----------|
| **商家 (Merchant)** | 门店所有者/店长 | 使用商家端管理门店日常运营 |
| **技师 (Technician)** | 门店服务人员 | 使用技师端查看工作状态与收益 |
| **消费者 (Consumer)** | 门店客户 | 未来版本开放预约、点钟、评价（Phase 3）|

### 2.2 商家角色特点

- 主要使用场景：桌面端/平板端
- 使用频率：每日多次
- 核心任务：技师管理、订单录入、工资核算、经营分析
- 技术能力：中等，对复杂系统有抵触

### 2.3 技师角色特点

- 主要使用场景：手机端（移动优先）
- 使用频率：每日工作中频繁查看
- 核心任务：状态切换、收益查看、资料维护
- 技术能力：一般，需要极简操作界面

---

## 3. 产品结构

### 3.1 商家端 (merchant-web)

**定位**：门店后台管理，偏桌面端，兼容平板与手机

**核心模块**：

| 模块 | 功能说明 | 文件路径 |
|------|----------|----------|
| 首页仪表盘 | 今日订单、营收、在岗技师、营业趋势 | merchant-dashboard.html |
| 技师管理 | 技师加入审核、在店状态、技师列表 | merchant-technicians.html |
| 订单管理 | 上钟记录、订单状态、当日订单 | merchant-orders.html |
| 经营统计 | 收入、工资支出、净营收、趋势、技师业绩 | merchant-analytics.html |
| 工资明细 | 工资规则设置、工资核算、发薪复核 | merchant-payroll.html |
| 门店设置 | 门店信息、技师加入二维码、套餐管理 | merchant-settings.html |

**设计要求**：
- 左侧导航 + 主内容区（桌面端）
- 手机端切换为顶部导航 / 抽屉导航
- 表格与列表支持移动端自动改卡片
- 所有筛选区支持换行与折叠
- 统计面板允许桌面双列、移动单列

### 3.2 技师端 (technician-web)

**定位**：手机优先的工作台，以技师个人任务完成为核心

**推荐形态**：移动优先 Web + PWA（支持安装到桌面）

**核心模块**：

| 模块 | 功能说明 | 文件路径 |
|------|----------|----------|
| 工作台 | 当前状态、最近结算、门店信息 | technician-home.html |
| 收益统计 | 收益趋势、收益记录 | technician-earnings.html |
| 我的资料 | 个人资料、当前签约门店、门店记录 | technician-profile.html |

**设计要求**：
- 顶部标题 + 底部导航
- 单列布局，一屏只做一件主任务
- 所有核心操作按钮要大
- 当前状态、门店关系、收益明细必须手机一屏能看清

### 3.3 消费者端 (consumer-web) - Phase 3

**定位**：预约与服务入口，几乎完全移动端

**当前状态**：保留品牌展示与入口位置，后续开发

---

## 4. 功能需求详情

### 4.1 认证与账号

#### 4.1.1 登录功能

- **登录方式**：手机号 + 密码
- **登录入口**：统一入口，根据角色自动跳转
- **会话管理**：JWT Token，保持登录状态
- **当前实现**：`POST /api/v1/auth/login`

#### 4.1.2 账号体系

- 商家与技师拥有独立账号
- 同一手机号不可同时注册商家与技师
- 商家不编辑技师个人资料，仅管理门店关系

### 4.2 商家端功能

#### 4.2.1 首页仪表盘

**数据展示**：
- 今日订单数
- 今日营收
- 在岗技师数
- 进行中订单
- 待钟技师
- 技师排行榜

**当前实现**：`GET /api/v1/merchant/dashboard`

#### 4.2.2 技师管理

**技师申请审核**：
- 查看技师加入申请列表
- 审核通过：建立签约关系
- 审核拒绝：填写拒绝原因
- 当前实现：`GET /api/v1/merchant/technician-applications`

**技师状态管理**：
- 在岗状态：在岗 / 离岗 / 休息
- 服务状态：待钟 / 服务中 / 休息
- 当前实现：`PATCH /api/v1/merchant/technicians/:technicianUserId/status`

**技师列表**：
- 筛选：按状态筛选
- 查看技师基础信息
- 不提供编辑技师个人资料的入口

#### 4.2.3 订单管理

**订单录入**：
- 选择技师
- 选择服务项目
- 选择订单类型（排钟 / 点钟）
- 填写房间号、客户姓名
- 设置服务金额
- 当前实现：`POST /api/v1/merchant/orders`

**订单状态**：
- 服务中：技师正在服务
- 已完成：服务结束，计入工资
- 已取消：不计入工资

**订单完成**：
- 结束上钟，订单状态改为已完成
- 当前实现：`PATCH /api/v1/merchant/orders/:orderId/complete`

**订单列表**：
- 按日期、状态、技师筛选
- 关键词搜索
- 当前实现：`GET /api/v1/merchant/orders`

#### 4.2.4 经营统计

**数据维度**：
- 时间维度：本月、本年、自定义日期范围
- 营业收入
- 工资支出
- 净营收
- 阶段趋势图
- 技师贡献排行

**当前实现**：`GET /api/v1/merchant/analytics`

#### 4.2.5 工资管理

**工资规则设置**：
- 门店默认规则：底薪、排钟提成率、点钟提成率、点钟奖金
- 技师覆盖规则：针对特定技师单独设置
- 当前实现：`PUT /api/v1/merchant/payroll/rules/default`

**工资周期管理**：
- 按月结算
- 周期状态：草稿 / 复核中 / 已发放

**工资核算**：
- 自动计算每位技师的本月工资
- 支持重新计算
- 当前实现：`POST /api/v1/merchant/payroll/cycles/:cycleId/recalculate`

**工资复核**：
- 查看每位技师的工资明细
- 逐笔订单复核
- 标记已发放
- 当前实现：`POST /api/v1/merchant/payroll/summaries/:summaryId/mark-paid`

#### 4.2.6 门店设置

**门店信息管理**：
- 门店名称
- 负责人姓名
- 联系电话
- 门店地址

**技师加入二维码**：
- 生成门店邀请二维码
- 技师扫码申请加入

**服务项目管理**：
- 添加/编辑/删除服务项目
- 设置项目名称、服务模式、价格、时长

**房间管理**：
- 添加/编辑/删除房间
- 设置房间号

**客户管理**：
- 会员客户档案
- 散客记录

**当前实现**：`GET/PUT /api/v1/merchant/settings`

### 4.3 技师端功能

#### 4.3.1 工作台

**当前门店**：
- 签约门店名称
- 入职时间

**当前状态**：
- 在岗状态
- 服务状态
- 当前服务信息（如有）

**收益概览**：
- 本月累计收益
- 最近结算记录

**当前实现**：`GET /api/v1/technician/home`

#### 4.3.2 收益统计

**收益趋势**：
- 近N月收益折线图
- 按月查看收益明细

**收益明细**：
- 订单类型（排钟/点钟）
- 服务金额
- 提成金额
- 关联订单时间

**当前实现**：`GET /api/v1/technician/earnings`

#### 4.3.3 我的资料

**个人信息**：
- 头像
- 姓名
- 简介
- 专长
- 从业年限

**当前实现**：`GET/PUT /api/v1/technician/profile`

**门店关系**：
- 当前签约门店
- 签约状态
- 签约历史记录

**申请加入门店**：
- 扫描门店二维码申请
- 当前实现：`POST /api/v1/technician/shop-applications`

**约束规则**：
- 同一时间仅可签约一家门店
- 签约期间不可再申请其他门店
- 解约后恢复申请资格

---

## 5. 业务流程

### 5.1 商家日常流程

```
1. 登录商家端
2. 查看首页经营概况
3. 处理技师加入申请
4. 录入新订单（技师上钟）
5. 订单完成后自动计入工资
6. 月底复核工资并发放
7. 查看经营统计，分析业务
```

### 5.2 技师日常工作流程

```
1. 登录技师端
2. 更新在岗状态
3. 开始服务（商家录入订单后自动更新状态）
4. 服务完成后状态自动恢复
5. 查看本月收益
6. 月底查看工资结算
```

### 5.3 工资结算流程

```
1. 月底商家开启工资周期复核
2. 系统根据工资规则自动计算每位技师工资
3. 商家逐笔复核订单明细
4. 如有调整可重新计算
5. 确认无误后标记发放
6. 技师端可查看发放状态
```

---

## 6. 技术架构

### 6.1 总体架构

```
┌─────────────────────────────────────────────────────────┐
│                      前端层                              │
├─────────────┬─────────────────┬────────────────────────┤
│ merchant-   │  technician-     │  consumer-             │
│ web         │  web             │  web (Phase 3)        │
│ (商家端Web) │  (技师端移动Web) │                        │
└──────┬──────┴────────┬────────┴───────────┬────────────┘
       │                 │                    │
       └─────────────────┼────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────┐
│                      API 层                              │
│              api.zubao-cn.xyz                           │
│                   Node.js + Express                      │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                     数据层                               │
│                   PostgreSQL                             │
└─────────────────────────────────────────────────────────┘
```

### 6.2 前端技术栈

| 项目 | 技术 | 说明 |
|------|------|------|
| 页面 | HTML5 + CSS3 + Vanilla JS | 非框架MVP阶段 |
| 请求 | Fetch API | 浏览器原生 |
| 字体 | Google Fonts (Inter, Manrope) | 编辑风格字体 |
| 图标 | Material Symbols | 统一图标库 |
| PWA | Service Worker + Manifest | 技师端支持安装 |

**注意**：项目当前不使用 React、Vue、Next.js、TypeScript、Tailwind CSS

### 6.3 后端技术栈

| 项目 | 技术 | 说明 |
|------|------|------|
| 运行时 | Node.js 22+ | LTS版本 |
| 框架 | Express 4 | 轻量Web框架 |
| 数据库 | PostgreSQL | 关系型数据库 |
| 驱动 | pg | PostgreSQL Node客户端 |
| 认证 | JWT (自定义实现) | 轻量鉴权方案 |
| 环境 | dotenv | 环境变量管理 |

### 6.4 部署架构

| 域名 | 指向 | 说明 |
|------|------|------|
| www.zubao-cn.xyz | 前端静态资源 | 官网/演示站 |
| api.zubao-cn.xyz | api-server | 统一API服务 |
| merchant.zubao-cn.xyz | merchant-web | 商家端 (规划) |
| technician.zubao-cn.xyz | technician-web | 技师端 (规划) |

**部署工具**：
- 反向代理：Nginx
- HTTPS：Certbot / Let's Encrypt
- 进程守护：PM2
- 服务器：腾讯云中国香港轻量服务器

---

## 7. 数据库设计

### 7.1 核心表结构

#### 用户与认证
- `users` - 统一账号表
- `refresh_tokens` - Token刷新表

#### 商家
- `merchant_profiles` - 商家资料表

#### 技师
- `technician_profiles` - 技师资料表

#### 门店
- `shops` - 门店表
- `shop_staff_memberships` - 门店人员关系表
- `shop_join_applications` - 技师加入申请表

#### 业务
- `service_items` - 服务项目表
- `rooms` - 房间表
- `customers` - 客户表
- `orders` - 订单主表
- `technician_work_status_logs` - 技师状态日志表

#### 工资
- `payroll_rules` - 工资规则表
- `payroll_cycles` - 工资周期表
- `payroll_summaries` - 工资汇总表
- `payroll_order_items` - 工资订单明细表

### 7.2 数据规范

- **金额存储**：统一使用整数分，前端按元显示
- **时间格式**：ISO 8601，带时区
- **UUID**：使用标准UUID v4
- **JSON字段**：特殊属性使用jsonb类型

### 7.3 枚举值

```sql
-- 用户角色
user_role: 'merchant', 'technician'
user_status: 'active', 'disabled'

-- 门店关系
shop_role_in_membership: 'merchant_owner', 'merchant_manager', 'technician'
membership_status: 'pending', 'active', 'left', 'removed'

-- 申请状态
application_status: 'pending', 'approved', 'rejected', 'cancelled'

-- 订单
order_type: 'scheduled', 'designated'
order_status: 'in_service', 'completed', 'cancelled'

-- 技师状态
attendance_status: 'on_duty', 'off_duty', 'resting'
service_status: 'available', 'in_service', 'resting'

-- 工资
payroll_scope_type: 'shop_default', 'technician_override'
payroll_cycle_status: 'draft', 'reviewing', 'paid'
payment_status: 'pending', 'paid'
```

---

## 8. API 设计

### 8.1 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/auth/login | 账号密码登录 |
| GET | /api/v1/auth/me | 获取当前用户信息 |

### 8.2 商家端

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/merchant/dashboard | 首页数据 |
| GET | /api/v1/merchant/analytics | 经营统计 |
| GET | /api/v1/merchant/settings | 门店设置 |
| PUT | /api/v1/merchant/settings | 更新门店设置 |
| GET | /api/v1/merchant/technicians | 技师列表 |
| PATCH | /api/v1/merchant/technicians/:id/status | 修改技师状态 |
| GET | /api/v1/merchant/technician-applications | 申请列表 |
| POST | /api/v1/merchant/technician-applications/:id/approve | 通过申请 |
| POST | /api/v1/merchant/technician-applications/:id/reject | 拒绝申请 |
| GET | /api/v1/merchant/orders | 订单列表 |
| POST | /api/v1/merchant/orders | 新增订单 |
| PATCH | /api/v1/merchant/orders/:id | 修改订单 |
| PATCH | /api/v1/merchant/orders/:id/complete | 完成订单 |
| GET | /api/v1/merchant/payroll/overview | 工资概览 |
| GET | /api/v1/merchant/payroll/rules | 工资规则 |
| PUT | /api/v1/merchant/payroll/rules/default | 更新默认规则 |
| PUT | /api/v1/merchant/payroll/rules/technicians/:id | 更新技师规则 |
| GET | /api/v1/merchant/payroll/summaries | 工资汇总 |
| POST | /api/v1/merchant/payroll/cycles/:id/recalculate | 重新计算 |
| POST | /api/v1/merchant/payroll/summaries/:id/mark-paid | 标记已发 |
| GET | /api/v1/merchant/payroll/summaries/:id/items | 工资明细 |
| GET | /api/v1/master-data/service-items | 服务项目 |
| POST | /api/v1/master-data/service-items | 新增项目 |
| PUT | /api/v1/master-data/service-items/:id | 更新项目 |
| DELETE | /api/v1/master-data/service-items/:id | 删除项目 |
| GET | /api/v1/master-data/rooms | 房间列表 |
| POST | /api/v1/master-data/rooms | 新增房间 |
| PUT | /api/v1/master-data/rooms/:id | 更新房间 |
| DELETE | /api/v1/master-data/rooms/:id | 删除房间 |
| GET | /api/v1/master-data/customers | 客户列表 |
| POST | /api/v1/master-data/customers | 新增客户 |
| PUT | /api/v1/master-data/customers/:id | 更新客户 |
| DELETE | /api/v1/master-data/customers/:id | 删除客户 |

### 8.3 技师端

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/technician/home | 工作台数据 |
| GET | /api/v1/technician/earnings | 收益统计 |
| GET | /api/v1/technician/profile | 个人资料 |
| PUT | /api/v1/technician/profile | 更新资料 |
| GET | /api/v1/technician/membership | 当前门店关系 |
| POST | /api/v1/technician/shop-applications | 申请加入门店 |

---

## 9. 设计系统

### 9.1 设计理念

**High-End Editorial Experience**：打造如同翻阅高端生活杂志般的体验

- 色调：临床纯净与有机生长的对比
- 排版：Intentional Asymmetry（刻意不对称）
- 深度：通过叠加元素创造触觉豪华感

### 9.2 色彩体系

| 用途 | 颜色 | 色值 |
|------|------|------|
| Primary Sanctuary | 主品牌绿 | #006c49 |
| Primary Container | 浅品牌绿 | #10b981 |
| Surface | 画布底色 | #fcf8fb |
| On Surface | 内容色 | #1b1b1d |
| Surface Container Low | 次级内容块 | 底色层级 |
| Surface Container Lowest | 交互卡片 | #ffffff |
| Success | 成功状态 | #6ffbbe |

**"No-Line" 规则**：禁止使用1px实线分割内容，使用背景色阶变化代替

### 9.3 字体系统

| 用途 | 字体 | 说明 |
|------|------|------|
| 标题/Display | Manrope | 几何感强，权威编辑感 |
| 正文/Labels | Inter | 最佳可读性 |

**层级技巧**：section标题用headline-md，配合同色label-md "kicker"

### 9.4 圆角与组件

| 组件 | 圆角 | 说明 |
|------|------|------|
| Buttons | xl (1.5rem) | 主按钮使用渐变，无边框 |
| Cards | lg/xl | 禁止分隔线，用空白间距 |
| Input Fields | md | 聚焦时使用ghost border |
| Chips | md | 未选中/选中状态对比明显 |

### 9.5 动效规范

- 所有过渡使用 "Soothe" 缓动：`cubic-bezier(0.4, 0, 0.2, 1)`
- 时长：400ms
- 禁止快速生硬动画

---

## 10. 非功能需求

### 10.1 性能

- 页面首次加载 < 3秒
- API响应时间 < 500ms
- 技师端PWA离线可用（基础功能）

### 10.2 安全

- 所有API需认证
- 商家只能访问自己门店数据
- 技师只能访问自己相关数据
- 敏感操作需记录日志

### 10.3 可用性

- 支持主流浏览器（Chrome、Safari、Edge）
- 技师端支持iOS/Android
- 关键操作有明确状态反馈
- 错误信息友好，不暴露技术细节

### 10.4 兼容性

- 桌面端：1920x1080最优，支持1440p、1366p
- 平板端：1024x768最优
- 移动端：375px宽度以上

---

## 11. 页面状态规范

### 11.1 订单状态

| 状态 | 显示文案 | 含义 |
|------|----------|------|
| in_service | 服务中 | 技师正在服务 |
| completed | 已完成 | 服务结束，计入工资 |
| cancelled | 已取消 | 订单取消，不计入工资 |

### 11.2 技师工作状态

| 状态 | 显示文案 | 含义 |
|------|----------|------|
| on_duty | 在岗 | 可接新服务 |
| off_duty | 离岗 | 暂时离开 |
| resting | 休息 | 休息中 |

| 服务状态 | 显示文案 | 含义 |
|----------|----------|------|
| available | 待钟 | 等待服务 |
| in_service | 服务中 | 正在服务 |
| resting | 休息 | 休息状态 |

### 11.3 门店关系状态

| 状态 | 显示文案 | 含义 |
|------|----------|------|
| active | 当前签约中 | 正在该门店工作 |
| pending | 待审核 | 申请加入中 |
| left | 已离开 | 离开该门店 |
| removed | 已移除 | 被门店移除 |

### 11.4 工资状态

| 状态 | 显示文案 | 含义 |
|------|----------|------|
| draft | 草稿 | 工资周期刚开始 |
| reviewing | 复核中 | 商家正在复核 |
| paid | 已发放 | 工资已发放 |

| 发放状态 | 显示文案 | 含义 |
|----------|----------|------|
| pending | 待发放 | 等待发放 |
| paid | 已发放 | 已收到工资 |

---

## 12. 开发里程碑

### Phase 1 - MVP（当前阶段）

**目标**：完成核心业务流程

- [x] 项目结构搭建
- [x] 数据库设计与实现
- [x] 后端API框架
- [x] 前端页面开发
- [x] 认证系统
- [x] 商家端核心功能
- [x] 技师端核心功能
- [x] 工资计算逻辑
- [ ] 完整联调测试
- [ ] MVP发布

### Phase 2 - 完善

**目标**：提升用户体验

- [ ] 商家端响应式优化
- [ ] 技师端PWA完善
- [ ] 消息通知系统
- [ ] 数据导出功能

### Phase 3 - 消费者端

**目标**：拓展用户触点

- [ ] 消费者Web应用
- [ ] 门店浏览
- [ ] 预约点钟
- [ ] 评价系统

---

## 13. 术语表

| 术语 | 定义 |
|------|------|
| 排钟 | 按顺序安排的服务，技师被动接单 |
| 点钟 | 客户指定技师的服务 |
| 工资规则 | 定义技师收入计算的规则（底薪、提成率、奖金）|
| 工资周期 | 按月统计工资的时间单位 |
| 工资快照 | 生成工资时的订单数据快照，不可更改 |

---

## 14. 参考文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 项目逻辑文档 | docs/project-logic.md | 详细页面逻辑说明 |
| MVP后端设计 | docs/mvp-backend-design.md | 数据库与API详细设计 |
| 技术架构文档 | docs/technical-architecture.md | 三端拆分方案 |
| 技术栈说明 | docs/tech-stack.md | 现有技术栈详解 |
| 设计系统 | zubao_wellness_elite/DESIGN.md | 视觉设计规范 |
| 数据库SQL | db/mvp_schema.sql | 完整表结构 |
| API服务 | api-server/README.md | 后端启动与使用说明 |

---

## 附录：快速启动

### 前端预览

```bash
cd app
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080/login.html
```

### 后端启动

```bash
cd api-server
npm install
cp .env.example .env
# 配置 DATABASE_URL
npm run db:schema
npm run db:upgrade
npm run db:seed
npm run dev  # http://localhost:3001
```

### 演示账号

| 角色 | 手机号 | 密码 |
|------|--------|------|
| 商家 | 13800000001 | Zubao123! |
| 技师 | 13800000011 | Zubao123! |

---

*本文档由系统自动生成并每日更新，如有问题请联系开发团队。*
