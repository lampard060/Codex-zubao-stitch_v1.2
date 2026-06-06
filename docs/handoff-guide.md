# 足宝项目接手说明

## 1. 文档目的

这份文档给外包同学、前后端开发同学或新接手的项目成员使用，目标是让接手方快速理解：

- 这个项目当前做到什么程度
- 代码分别放在哪里
- 本地如何启动
- 数据库如何初始化
- 哪些业务规则已经定死，不要随意改
- 接手后建议先做什么，后做什么

## 2. 项目当前状态

当前仓库不是纯静态原型，而是一个 **前后端分离、已可本地联调的 MVP 项目**。

当前已具备：

- 官网首页与登录页
- 商家端核心页面
- 技师端核心页面
- Node.js + Express API
- PostgreSQL 数据库结构
- 登录、订单、工资、技师、基础资料等第一批真实接口
- 商家端“项目 / 房间 / 客户”主数据管理
- 订单选择式录入
- 技师端移动优先与 PWA 基础能力

当前更适合的理解是：

- 可以继续开发，不需要从零搭架构
- 还没有完全到“正式商用上线”
- 目前最需要的是统一 UI 设计收口，并继续把业务链路补完整

## 3. 仓库结构

### 根目录说明

- `app/`
  - 前端页面与样式、前端脚本
- `api-server/`
  - 后端 API 服务
- `db/`
  - PostgreSQL 建表、升级、种子数据
- `docs/`
  - 产品、技术、架构、测试与接手文档

### 前端目录

前端当前采用原生 HTML + CSS + JavaScript。

关键文件：

- [app/index.html](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/index.html)
- [app/login.html](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/login.html)
- [app/merchant-dashboard.html](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/merchant-dashboard.html)
- [app/merchant-orders.html](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/merchant-orders.html)
- [app/merchant-master-data.html](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/merchant-master-data.html)
- [app/technician-home.html](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/technician-home.html)
- [app/app.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/app.js)
- [app/styles.css](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app/styles.css)

### 后端目录

后端当前采用 Node.js + Express。

关键文件：

- [api-server/src/server.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/server.js)
- [api-server/src/app.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/app.js)
- [api-server/src/routes/auth.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/routes/auth.js)
- [api-server/src/routes/merchant.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/routes/merchant.js)
- [api-server/src/routes/master-data.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/routes/master-data.js)
- [api-server/src/routes/orders.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/routes/orders.js)
- [api-server/src/routes/payroll.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/routes/payroll.js)
- [api-server/src/routes/technicians.js](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/src/routes/technicians.js)

### 数据库目录

关键文件：

- [db/mvp_schema.sql](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/db/mvp_schema.sql)
- [db/mvp_masterdata_upgrade.sql](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/db/mvp_masterdata_upgrade.sql)
- [db/mvp_seed.sql](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/db/mvp_seed.sql)
- [db/mvp_demo_seed.sql](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/db/mvp_demo_seed.sql)

## 4. 技术栈

### 前端

- HTML5
- CSS3
- 原生 JavaScript
- `fetch`
- 技师端 PWA 基础能力

### 后端

- Node.js 22+
- Express 4
- dotenv
- cors
- pg

### 数据库

- PostgreSQL
- SQL 文件维护表结构，不使用 ORM

### 本地开发

- 前端预览：`python3 -m http.server`
- 后端启动：`node src/server.js`

如需了解更完整技术栈说明，先看：

- [docs/tech-stack.md](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/docs/tech-stack.md)

## 5. 当前页面与模块

### 官网与登录

- 官网首页
- 登录页

### 商家端

- 首页
- 技师管理
- 订单管理
- 经营统计
- 工资明细
- 基础资料
  - 项目管理
  - 房间管理
  - 客户管理
- 门店设置

### 技师端

- 工作台
- 收益统计
- 我的资料

详细页面关系可看：

- [docs/project-logic.md](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/docs/project-logic.md)

## 6. 本地启动方式

### 6.1 启动数据库

本地需要先有 PostgreSQL。

### 6.2 初始化数据库

进入后端目录：

```bash
cd /Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server
```

导入建表：

```bash
npm run db:schema
```

如果项目结构升级过，再执行：

```bash
npm run db:upgrade
```

导入空白测试基线：

```bash
npm run db:seed
```

如果要恢复历史演示数据：

```bash
node scripts/run-sql-file.js ../db/mvp_demo_seed.sql
```

### 6.3 启动后端

```bash
cd /Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server
npm install
node src/server.js
```

默认地址：

- `http://127.0.0.1:3001`

健康检查：

- `GET /api/v1/health`

### 6.4 启动前端

```bash
cd /Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app
python3 -m http.server 4173 --bind 0.0.0.0
```

本地访问：

- `http://127.0.0.1:4173/login.html`

手机同局域网访问：

- `http://你的电脑局域网IP:4173/login.html`

## 7. 环境变量说明

后端使用：

- [api-server/.env](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/.env)
- [api-server/.env.example](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/.env.example)

如果新环境启动，先复制：

```bash
cp .env.example .env
```

再根据本机 PostgreSQL 配置修改数据库连接信息。

## 8. 测试账号

当前默认测试账号：

- 商家账号：`13800000001`
- 技师账号：`13800000011`
- 备用技师账号：`13800000012`
- 默认密码：`Zubao123!`

## 9. 当前已实现的核心能力

### 商家端

- 登录与角色跳转
- 首页经营概况读取
- 技师列表、加入申请、状态调整
- 项目管理
- 房间管理
- 客户管理
- 订单新增
- 订单编辑
- 订单取消
- 订单完成
- 订单详情查看
- 订单按状态筛选
- 统计页周期切换
- 工资规则读取与修改
- 工资明细查看
- 工资导出 CSV

### 技师端

- 登录
- 工作台读取
- 收益页读取
- 我的资料读取与保存
- 状态切换
- 头像本地预览与保存到资料字段
- 移动底部导航
- PWA manifest 与 service worker
- 网络状态提示

### 后端

- 登录接口
- 当前用户接口
- 商家首页、统计、设置读取
- 技师管理读写
- 主数据管理读写
- 订单读写
- 工资读写
- 技师端读写

## 10. 已确定的业务规则

这些是当前阶段已经明确的规则，接手时不要随意推翻。

### 10.1 金额规则

- 数据库存储统一按“分”
- 前端输入与展示统一按“元”
- 例如输入 `398`，前端应理解为 `398.00`
- 提交到后端前自动转换成 `39800`

### 10.2 技师与门店关系

- 技师拥有独立账号
- 技师同一时间只能签约一家门店
- 签约后不能再申请其它门店
- 解约后才可重新申请

### 10.3 订单录入方式

- 订单必须按“选择式录入”
- 新增订单时选择：
  - 技师
  - 项目
  - 房间
  - 客户
- 不再允许商家手填项目价格、房号、客户名称作为主流程
- 未建档客户按“散客”处理

### 10.4 技师端方向

- 技师端默认按移动优先设计
- 技师端继续按 PWA 方向推进
- 不建议再按桌面后台思路去堆模块

## 11. 当前未完成或需要继续优化的点

以下内容仍然属于“下一阶段继续开发”的重点：

- 当前 UI 经过多轮调整，视觉风格已经不够统一
- 用户计划使用 Google Stitch 重新设计页面，后续应以 Stitch 设计稿为准统一重构 UI
- 鉴权目前是轻量实现，后续可升级为更正式的 JWT / 刷新机制
- 头像上传目前还是前端本地预览 + 资料字段保存，不是正式文件上传方案
- 消费者端仍未正式开发
- 商家端移动端适配还不完整
- 线上数据库尚未迁云

## 12. 推荐接手顺序

建议接手时按下面顺序推进，不要跳着改。

1. 先把本地环境跑起来
2. 跑一次数据库初始化与烟测
3. 理解商家端、技师端和 API 的对应关系
4. 优先按新的 Stitch 设计统一前端 UI
5. UI 稳定后再继续补业务功能
6. MVP 核心链路稳定后，再考虑数据库迁云与正式部署

## 13. 接手后第一轮建议任务

推荐第一轮接手任务：

1. 通读以下文档
2. 跑通本地前后端
3. 跑一次 `npm run smoke`
4. 检查当前页面与接口是否一致
5. 基于新的 Stitch 设计稿做 UI 收口

优先阅读文档：

- [docs/tech-stack.md](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/docs/tech-stack.md)
- [docs/project-logic.md](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/docs/project-logic.md)
- [docs/mvp-backend-design.md](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/docs/mvp-backend-design.md)
- [docs/technical-architecture.md](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/docs/technical-architecture.md)
- [api-server/README.md](/Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server/README.md)

## 14. 常用命令

安装依赖：

```bash
cd /Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/api-server
npm install
```

导入建表：

```bash
npm run db:schema
```

导入升级脚本：

```bash
npm run db:upgrade
```

导入空白基线：

```bash
npm run db:seed
```

运行烟测：

```bash
npm run smoke
```

启动后端：

```bash
node src/server.js
```

启动前端：

```bash
cd /Users/frankzhang/Desktop/Codex-zubao-stitch_v1.2/app
python3 -m http.server 4173 --bind 0.0.0.0
```

## 15. 上线前注意事项

- 先统一 UI，再谈正式上线
- 上线前必须完成一轮完整业务验收
- 数据库迁云建议放在核心 MVP 稳定后进行
- 不建议在当前阶段直接把本地测试数据带到生产环境
- 正式上线前要再补：
  - 更稳的鉴权
  - 文件上传
  - 更完整的异常处理
  - 更完整的权限校验

## 16. 仓库地址

当前 GitHub 仓库：

- [Codex-zubao-stitch_v1.2](https://github.com/lampard060/Codex-zubao-stitch_v1.2)
