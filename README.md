# ZuBao

ZuBao is an open-source full-stack MVP for digitizing day-to-day operations in spa and foot-massage shops. The repository combines merchant-side operations, technician workflows, payroll logic, backend APIs, PostgreSQL schema scripts, deployment setup, and mobile-friendly PWA support in one maintainable codebase.

This project is being developed as a reusable operational system rather than a static prototype. It is intended to support real service-business workflows such as order handling, technician management, settlement, store configuration, and day-to-day operational visibility.

## Scope

- Merchant dashboard and back-office workflows
- Technician mobile workflow and PWA support
- Express-based API server
- PostgreSQL schema, seed, and upgrade scripts
- Product, technical, and deployment documentation

## Repository Structure

- `app/`: frontend pages, styles, scripts, and PWA assets
- `api-server/`: Node.js + Express backend
- `db/`: PostgreSQL schema, seed, and upgrade SQL
- `docs/`: product, technical, handoff, and planning documents
- `deploy/`: deployment notes and server setup assets

## Current Status

- Merchant-side pages and technician-side pages are available for continued integration
- Frontend structure has been modularized for follow-up component and data work
- MVP backend routes and database scripts are included in the repository
- Project and deployment documentation are maintained alongside code

## Main Entry Points

- Landing page: `app/index.html`
- Login page: `app/login.html`
- Merchant dashboard: `app/merchant-dashboard.html`
- Technician home: `app/technician-home.html`

## Key Docs

- Product requirements: `docs/PRD.md`
- Tech stack summary: `docs/tech-stack.md`
- Project handoff guide: `docs/handoff-guide.md`
- Project summary: `docs/project-summary-2026-06-03.md`
- Alicloud deployment notes: `deploy/alicloud-ubuntu/README.md`

## Chinese Summary

### 项目说明

当前目录包含足宝项目的前端页面、后端接口骨架、数据库脚本与配套文档，可用于产品评审、视觉确认、本地联调与后续正式开发衔接。

### 当前状态

- 已完成官网、登录页、商家端和技师端的主要页面整理
- 已统一页面结构、文案风格、状态词与导航关系
- 当前版本可直接用于继续进行组件化开发与数据接入
- 已补充 MVP 后端设计、建表 SQL、部署说明与 `api-server` 骨架

### 中文入口

- 官网落地页: `app/index.html`
- 登录页: `app/login.html`
- 商家首页: `app/merchant-dashboard.html`
- 技师工作台: `app/technician-home.html`
- 项目逻辑文档: `docs/project-logic.md`
- MVP 后端设计: `docs/mvp-backend-design.md`
- MVP 建表 SQL: `db/mvp_schema.sql`
- 上线前测试方案: `docs/go-live-test-plan.md`
- 正式版技术架构: `docs/technical-architecture.md`
- 当前技术栈说明: `docs/tech-stack.md`
- 项目接手说明: `docs/handoff-guide.md`
- 阿里云单机部署: `deploy/alicloud-ubuntu/README.md`
