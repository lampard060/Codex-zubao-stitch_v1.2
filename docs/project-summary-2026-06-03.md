# 足宝项目总结（2026-06-03）

## 1. 项目定位

足宝当前是一个可本地联调的 MVP 项目，不是纯静态原型。项目目标是覆盖足疗/按摩门店的两端业务：

- 商家端：门店经营、订单、技师、工资、基础资料
- 技师端：工作台、收益、个人资料、申请加入门店

当前代码已经具备前后端分离结构、数据库脚本、真实接口和静态前端页面，适合继续迭代，不需要从零搭架构。

## 2. 仓库结构

- `app/`
  - 前端静态页面、样式、模块化前端脚本、技师端 PWA 资源
- `api-server/`
  - Node.js + Express API
- `db/`
  - PostgreSQL 建表、升级、种子数据、清理脚本
- `docs/`
  - 产品、技术、交接、计划类文档

## 3. 技术栈

### 前端

- 原生 HTML + CSS + JavaScript
- 页面脚本已拆分到 `app/js/pages/` 和 `app/js/utils/`
- 入口为 `app/js/main.js`
- 使用 `fetch` 请求后端 API
- 技师端有独立 PWA 支持：
  - `app/technician.webmanifest`
  - `app/technician-sw.js`
  - `app/js/utils/pwa.js`

### 后端

- Node.js 22+
- Express 4
- `pg`
- `dotenv`
- `cors`

### 数据库

- PostgreSQL
- SQL 文件维护结构，不使用 ORM
- 金额字段底层以“分”为主，前端展示统一转换为“元”

## 4. 当前主要页面

### 商家端

- `app/merchant-dashboard.html`
- `app/merchant-orders.html`
- `app/merchant-analytics.html`
- `app/merchant-technicians.html`
- `app/merchant-payroll.html`
- `app/merchant-payroll-detail.html`
- `app/merchant-services.html`
- `app/merchant-rooms.html`
- `app/merchant-members.html`
- `app/merchant-member-records.html`
- `app/merchant-master-data.html`
- `app/merchant-settings.html`
- `app/merchant-approvals.html`
- `app/merchant-commission-settings.html`

### 技师端

- `app/technician-home.html`
- `app/technician-earnings.html`
- `app/technician-profile.html`
- `app/technician-join-shop.html`
- `app/technician-rest.html`

### 公共入口

- `app/index.html`
- `app/login.html`

## 5. 后端核心路由

- `api-server/src/routes/auth.js`
- `api-server/src/routes/merchant.js`
- `api-server/src/routes/orders.js`
- `api-server/src/routes/payroll.js`
- `api-server/src/routes/master-data.js`
- `api-server/src/routes/technicians.js`
- `api-server/src/routes/health.js`

## 6. 当前已实现能力

### 商家端

- 登录、鉴权、角色跳转
- 工作台数据概览
- 订单新增、编辑、完成、取消、筛选
- 技师列表、状态切换、加入申请审核
- 工资规则、工资汇总、工资明细、标记发放
- 项目 / 房间 / 客户等主数据管理
- 经营统计与图表展示
- 门店设置

### 技师端

- 登录后自动识别签约状态
- 未签约时进入申请加入门店流程
- 工作台状态展示和核心工作流程
- 收益页的分周期统计
- 资料页展示和基础编辑交互
- 底部导航、移动端壳层、PWA 基础能力

## 7. 最近这一轮已完成的重点调整

这部分是新对话最值得继承的上下文。

### 7.1 技师工作台 UI 收口

- 工作台页面已按技师端暗色风格重新收口
- “待服务 / 服务中”订单已从“今日已完成订单”中拆出，作为独立模块展示
- 修复了按钮和文案落回浏览器默认样式的问题

相关文件：

- `app/technician-home.html`
- `app/js/pages/technician-home.js`
- `app/technician-redesign.css`

### 7.2 技师端金额口径统一

- 技师端展示金额现在与商家端一致，统一按“元”显示，并保留两位小数
- 修复过技师端原先直接把“分”显示出来的问题，例如 `29800` 应显示为 `298.00`

涉及位置：

- 工作台预估收益
- 收益页大卡、小卡、趋势图、明细

相关文件：

- `app/js/utils/technician-shared.js`
- `app/js/pages/technician-home.js`
- `app/js/pages/technician-earnings.js`
- `api-server/src/routes/technicians.js`

### 7.3 技师收益口径调整

技师收益页目前采用双口径：

- 大卡片：技师实际可得收益
- 小卡片“服务总额”：技师服务订单给门店贡献的营业额

当前 tab 口径约定：

- `今日`：今天累计收益
- `本月`：本月累计收益
- `工资`：上月工资
- `年度`：本年度累计收益

### 7.4 技师收益趋势和明细修复

- 柱状图已修正为显示实际数值，不再显示 `MAX`
- 单柱场景已做居中处理，柱体和底部标签对齐
- 收益页图标兜底已补齐，避免显示 `bar_chart` 文字
- `本月` tab 下，“最近明细”已按“日期聚合”展示：
  - 只显示有收益的日期
  - 每行显示日期、完成单数、当天收益

相关文件：

- `app/js/pages/technician-earnings.js`
- `app/js/utils/icon-fallback.js`
- `app/js/icon-fallback-inline.js`
- `app/technician-redesign.css`
- `api-server/src/routes/technicians.js`

### 7.5 技师端缓存与资源版本

为避免前端修改后仍命中旧缓存，近期多次提升了：

- `technician-earnings.html` / `technician-home.html` 的脚本版本号
- `app/js/utils/pwa.js` 中的 service worker 注册版本号
- `app/technician-sw.js` 中的缓存名

如果页面表现与代码不一致，优先怀疑：

1. 浏览器缓存
2. service worker 旧缓存
3. 页面资源版本号没有同步刷新

## 8. 本地启动方式

### 后端

目录：

```bash
cd /Users/frankzhang/Desktop/Claude-zubao-stitch_v1.2_副本/api-server
```

常用命令：

```bash
npm install
npm run dev
```

默认地址：

- `http://127.0.0.1:3001`

健康检查：

- `GET /api/v1/health`

### 前端

目录：

```bash
cd /Users/frankzhang/Desktop/Claude-zubao-stitch_v1.2_副本/app
```

常用命令：

```bash
python3 -m http.server 8080
```

默认访问：

- `http://127.0.0.1:8080/login.html`
- `http://127.0.0.1:8080/technician-home.html`
- `http://127.0.0.1:8080/technician-earnings.html`

## 9. 数据库与脚本

关键文件：

- `db/mvp_schema.sql`
- `db/mvp_masterdata_upgrade.sql`
- `db/add_refresh_tokens.sql`
- `db/mvp_seed.sql`
- `db/mvp_demo_seed.sql`

后端 `package.json` 中已有脚本：

- `npm run db:schema`
- `npm run db:upgrade`
- `npm run db:seed`
- `npm run smoke`

相关脚本目录已存在：

- `api-server/scripts/run-sql-file.js`
- `api-server/scripts/smoke-test.js`

## 10. 测试账号

- 商家：`13800000001`
- 技师：`13800000011`
- 备用技师：`13800000012`
- 默认密码：`Zubao123!`

## 11. 当前需要注意的已知事项

### 11.1 技师端强依赖缓存刷新

技师端是 PWA 化页面，前端改动后如果浏览器还在吃旧缓存，页面会表现出“代码改了但界面没变”的情况。遇到这类问题，优先做硬刷新，必要时清理 service worker。

### 11.2 `node --watch` 偶发端口占用提示

开发时后端通常用 `npm run dev`（即 `node --watch src/server.js`）运行。文件频繁变动时，日志里偶尔会出现 `EADDRINUSE: 3001` 的重启提示，但只要后续又打印 `ZuBao API listening on http://0.0.0.0:3001`，说明服务已经恢复监听。

### 11.3 仓库当前是脏工作区

`git status` 显示当前仓库包含较多已修改和新增文件，其中包括：

- 商家端页面和后端路由的持续改动
- 技师端近期收口改动
- 文档和 SQL 脚本补充
- 一些历史截图/草稿文件删除

新对话里如果要继续改代码，最好先基于“脏工作区继续工作”的前提，不要默认回滚。

## 12. 建议新对话优先做什么

如果你新开一个对话，建议优先让它从下面这几个方向接手：

1. 继续技师端 UI 收口
   - 收益页细节视觉一致性
   - 工作台主卡片层级和空状态优化
2. 做一次端到端流程回归
   - 商家登录 -> 新增订单 -> 完成订单
   - 技师登录 -> 工作台 -> 收益页核对
3. 清理文档和运行说明
   - 把旧路径文档统一成当前仓库路径
   - 整理一份最终 README
4. 评估是否要继续前端组件化
   - 目前原生 JS 可继续维护
   - 但页面数量上来后，共享组件和状态管理会越来越需要规范

## 13. 推荐给下一个对话的简短提示词

可以直接把下面这段发给下一个对话：

```md
请先阅读 `docs/project-summary-2026-06-03.md`，基于其中记录的当前项目状态继续工作。

当前仓库是足宝项目的前后端分离 MVP：
- 前端在 `app/`
- 后端在 `api-server/`
- 数据库脚本在 `db/`

最近主要改的是技师端工作台和收益页，尤其是：
- 技师端金额从“分”统一修正为“元”
- 收益页按不同 tab 使用不同统计口径
- 本月明细按日期聚合
- 图标和图表样式做过修复

请不要假设仓库是干净的，也不要回滚现有改动。先基于现状阅读代码，再继续实现。
```

