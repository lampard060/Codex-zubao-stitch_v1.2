# 足宝阿里云单机部署指南

适用场景：

- 阿里云海外云服务器
- Ubuntu 22.04 LTS
- 单机部署
- 前端静态页面 + Node API + PostgreSQL

推荐域名：

- `www.zubao-cn.xyz`：前端站点
- `api.zubao-cn.xyz`：后端接口

## 1. 购买服务器

建议选择：

- 规格：`2C4G`
- 系统：`Ubuntu 22.04 LTS`
- 公网 IP：开启
- 安全组端口：`22`、`80`、`443`

## 2. 服务器初始化

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx postgresql postgresql-contrib certbot python3-certbot-nginx
```

安装 Node.js 22：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 3. 域名解析

在 DNS 面板中新增 A 记录：

- `www.zubao-cn.xyz -> 服务器公网 IP`
- `api.zubao-cn.xyz -> 服务器公网 IP`

解析生效后再继续 HTTPS。

## 4. 拉取代码

```bash
cd /srv
sudo git clone <你的仓库地址> zubao
sudo chown -R $USER:$USER /srv/zubao
```

## 5. 初始化 PostgreSQL

```bash
sudo -u postgres psql
```

执行：

```sql
CREATE USER zubao_user WITH PASSWORD '替换成强密码';
CREATE DATABASE zubao OWNER zubao_user;
\q
```

## 6. 配置后端环境变量

```bash
cd /srv/zubao/api-server
cp .env.production.example .env
```

编辑 `.env`：

```env
NODE_ENV=production
PORT=3001

APP_URL=https://www.zubao-cn.xyz
API_URL=https://api.zubao-cn.xyz

DATABASE_URL=postgresql://zubao_user:你的强密码@127.0.0.1:5432/zubao
JWT_SECRET=换成一串足够长的随机密钥
```

可用下面命令生成随机密钥：

```bash
openssl rand -hex 32
```

## 7. 安装依赖并初始化数据库

也可以直接运行辅助脚本：

```bash
cd /srv/zubao
bash deploy/alicloud-ubuntu/bootstrap-api.sh
```

或手动执行：

```bash
cd /srv/zubao/api-server
npm install
npm run db:schema
npm run db:upgrade
npm run db:seed
```

说明：

- `db:seed` 当前是上线前空白基线
- 会保留最小账号、门店、默认工资规则
- 不会写入大批演示业务数据

## 8. 启动 API 并验证

先前台验证：

```bash
cd /srv/zubao/api-server
npm run start
```

另开一个终端：

```bash
curl http://127.0.0.1:3001/api/v1/health
```

看到 `ok: true` 后停止前台进程，改为 systemd。

## 9. 配置 systemd

复制模板：

```bash
sudo cp /srv/zubao/deploy/alicloud-ubuntu/systemd/zubao-api.service /etc/systemd/system/zubao-api.service
```

启用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable zubao-api
sudo systemctl start zubao-api
sudo systemctl status zubao-api
```

查看日志：

```bash
journalctl -u zubao-api -f
```

## 10. 配置 Nginx

复制模板：

```bash
sudo cp /srv/zubao/deploy/alicloud-ubuntu/nginx/zubao-www.conf /etc/nginx/sites-available/zubao-www
sudo cp /srv/zubao/deploy/alicloud-ubuntu/nginx/zubao-api.conf /etc/nginx/sites-available/zubao-api
sudo ln -sf /etc/nginx/sites-available/zubao-www /etc/nginx/sites-enabled/zubao-www
sudo ln -sf /etc/nginx/sites-available/zubao-api /etc/nginx/sites-enabled/zubao-api
sudo nginx -t
sudo systemctl reload nginx
```

## 11. 配置 HTTPS

```bash
sudo certbot --nginx -d www.zubao-cn.xyz -d zubao-cn.xyz
sudo certbot --nginx -d api.zubao-cn.xyz
sudo systemctl status certbot.timer
```

## 12. 上线前检查

```bash
curl https://api.zubao-cn.xyz/api/v1/health
```

再按仓库内测试方案完整验收：

- `docs/go-live-test-plan.md`

## 13. 上线后第一天必须做

### 改掉默认账号密码

先生成密码哈希：

```bash
cd /srv/zubao/api-server
node scripts/hash-password.js '你的新密码'
```

再进入 PostgreSQL 执行：

```bash
sudo -u postgres psql -d zubao
```

```sql
update users
set password_hash = '把上一步输出的 scrypt 哈希填进来',
    updated_at = now()
where phone = '13800000001';
```

对技师测试账号重复执行同样动作。

### 备份数据库

```bash
mkdir -p /srv/backups/zubao
pg_dump -U zubao_user -h 127.0.0.1 zubao > /srv/backups/zubao/first-day-backup.sql
```

### 常用运维命令

```bash
sudo systemctl status zubao-api
journalctl -u zubao-api -f
sudo systemctl reload nginx
```
