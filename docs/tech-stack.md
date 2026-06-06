# 足宝项目技术栈说明

## 一、项目当前形态

当前项目是一个 **前后端分离的 MVP / 演示可联调项目**，由以下几部分组成：

- 前端静态页面：位于 `app/`
- 后端 API 服务：位于 `api-server/`
- PostgreSQL 数据库结构与种子数据：位于 `db/`
- 产品与架构文档：位于 `docs/`

当前代码已经不是纯静态原型，而是：

- 商家端、技师端页面可调用真实 API
- 后端已具备登录、订单、工资、技师、基础资料等接口
- 数据库已具备 MVP 阶段的核心表结构

## 二、前端技术栈

### 1. 页面层

当前前端没有使用 React、Vue、Next.js 等前端框架，采用的是：

- **HTML5**
- **CSS3**
- **原生 JavaScript（Vanilla JS）**

页面主要在以下目录：

- `/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app`

代表文件：

- [官网首页](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/index.html)
- [登录页](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/login.html)
- [商家订单页](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/merchant-orders.html)
- [基础资料页](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/merchant-master-data.html)
- [技师工作台](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/technician-home.html)

### 2. 前端脚本组织

当前前端主要逻辑集中在一个脚本文件：

- [app.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/app.js)

它负责：

- 登录与本地 session 管理
- 页面初始化
- 调用后端 API
- 商家端和技师端交互逻辑
- 金额格式化与金额输入转换
- 技师端 PWA 相关逻辑

### 3. 样式层

当前样式体系为：

- **纯 CSS**
- 单一全局样式文件管理

样式文件：

- [styles.css](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/styles.css)

### 4. UI 资源

当前前端使用的外部 UI 资源包括：

- **Google Fonts**
  - `Inter`
  - `Manrope`
- **Google Material Symbols**

### 5. 前端请求方式

前端通过浏览器原生：

- `fetch`

来请求后端 API。

当前 API 基地址在前端脚本中按访问主机动态拼接：

- `http(s)://<当前主机>:3001/api/v1`

### 6. 技师端 PWA

技师端已经开始按移动优先和 PWA 方向实现，当前包含：

- `manifest`
- `service worker`
- 安装提示
- 离线/网络状态提示
- 移动底部导航

相关文件：

- [technician.webmanifest](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/technician.webmanifest)
- [technician-sw.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/technician-sw.js)
- [zubao-tech-icon.svg](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/zubao-tech-icon.svg)

## 三、后端技术栈

### 1. 运行时

后端运行时为：

- **Node.js 22+**

在 `package.json` 中要求：

- `node >= 22`

### 2. 服务框架

后端 Web 服务框架为：

- **Express 4**

主入口文件：

- [server.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/server.js)
- [app.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/app.js)

### 3. 后端依赖

当前核心依赖为：

- `express`
- `cors`
- `dotenv`
- `pg`

对应文件：

- [api-server/package.json](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/package.json)

### 4. 当前后端能力

后端目前已经覆盖这些模块：

- 健康检查
- 登录认证
- 商家首页 / 统计 / 设置
- 技师管理 / 申请审核
- 订单管理
- 工资管理
- 基础资料管理
  - 项目管理
  - 房间管理
  - 客户管理
- 技师端工作台 / 收益 / 资料

主要路由文件：

- [auth.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/routes/auth.js)
- [merchant.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/routes/merchant.js)
- [master-data.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/routes/master-data.js)
- [orders.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/routes/orders.js)
- [payroll.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/routes/payroll.js)
- [technicians.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/routes/technicians.js)

### 5. 鉴权方式

当前项目后端鉴权为自定义轻量实现，包含：

- 登录接口
- token 签发与校验
- 请求上下文注入

相关文件：

- [token.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/lib/token.js)
- [auth.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/middleware/auth.js)
- [request-context.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/lib/request-context.js)

### 6. 密码处理

当前密码校验为服务端自定义实现，相关逻辑在：

- [password.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/lib/password.js)

## 四、数据库技术栈

### 1. 数据库类型

当前数据库为：

- **PostgreSQL**

Node 侧连接驱动为：

- `pg`

### 2. 数据模型

数据库结构以 SQL 文件维护，而不是 ORM。

当前主要文件：

- [mvp_schema.sql](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/db/mvp_schema.sql)
- [mvp_masterdata_upgrade.sql](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/db/mvp_masterdata_upgrade.sql)
- [mvp_seed.sql](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/db/mvp_seed.sql)
- [mvp_demo_seed.sql](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/db/mvp_demo_seed.sql)

### 3. 当前数据库设计特点

- 金额统一按 **分** 存储，前端按 **元** 输入和显示
- 商家、技师、门店、订单、工资、项目、房间、客户已拆成独立表
- 订单现在已经支持关联：
  - 项目
  - 房间
  - 客户
- 客户支持：
  - 建档客户
  - 散客

## 五、本地开发技术栈

### 1. 前端预览

当前本地预览通常通过：

- `python3 -m http.server`

把 `app/` 目录作为静态站点启动。

### 2. 后端启动

后端本地通过 Node 直接运行：

- `node src/server.js`

或开发模式：

- `node --watch src/server.js`

### 3. 环境变量

后端环境变量通过：

- `.env`
- `dotenv`

加载。

示例文件：

- [api-server/.env.example](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/.env.example)

### 4. 自测方式

当前项目带有本地烟测脚本：

- [smoke-test.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/scripts/smoke-test.js)

用于测试：

- 登录
- 基础资料创建
- 订单新增/编辑/完成
- 工资规则更新
- 技师端基础接口

## 六、部署与运行方式

结合当前项目实际和已走通的流程，当前部署形态是：

- 前端：静态页面
- 后端：Node + Express API
- 数据库：PostgreSQL
- 反向代理：Nginx
- HTTPS：Certbot / Let's Encrypt
- 进程守护：PM2
- 服务器：腾讯云中国香港轻量服务器

也就是说，当前项目不是 Serverless 架构，而是：

**传统 Web 服务器 + Node API + PostgreSQL** 架构。

## 七、当前不是的技术栈

当前项目 **没有使用** 以下技术：

- React
- Vue
- Next.js
- Nuxt
- TypeScript
- Tailwind CSS
- Supabase
- Prisma
- Drizzle
- MySQL
- Redis
- Docker

这些都不是当前仓库的实际技术栈。

## 八、一句话总结

当前足宝项目的实际技术栈是：

> **前端使用 HTML + CSS + 原生 JavaScript，后端使用 Node.js + Express，数据库使用 PostgreSQL，技师端已开始按 PWA 方向实现，整体以 SQL 建模和传统服务器部署为主。**
