# Ubuntu 24.04 VPS 部署文档

本文档适用于将当前 `todolist` 项目部署到 Ubuntu 24.04 LTS VPS，并在同一台服务器上部署 PostgreSQL 数据库。本文默认按“只有公网 IP、没有域名”的方式部署。

项目技术栈：

- Next.js 16
- React 19
- Prisma 7
- PostgreSQL
- Node.js 20+，推荐 Node.js 22 LTS
- 应用默认监听端口：`3001`

> 重要：只有公网 IP 时通常使用 `http://公网IP` 访问。此模式需要在 `.env` 中设置 `SESSION_COOKIE_SECURE="false"`，否则生产环境登录 Cookie 可能无法保存。该方案可以正常使用，但安全性弱于 HTTPS；以后有域名后建议切回 HTTPS。

## 1. 部署前准备

你需要准备：

- 一台 Ubuntu 24.04 LTS VPS
- VPS 公网 IP，例如 `203.0.113.10`
- root 或 sudo 权限
- 项目源码获取方式，例如 Git 仓库地址或上传源码包
- 云厂商安全组放行 `22` 和 `80`

以下命令默认使用 `sudo` 执行；如果你已是 root，可以省略 `sudo`。

## 2. 安装基础依赖

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl wget ca-certificates nginx ufw build-essential

sudo systemctl enable --now nginx
```

配置系统防火墙：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw --force enable
sudo ufw status
```

如果你的 SSH 不是 `22` 端口，先放行你的自定义 SSH 端口，再启用 UFW。

## 3. 2 核 2G 机器建议开启 swap

2G 内存运行本项目够用，但 `npm run build` 和依赖安装时可能出现短时内存峰值。建议开启 2G swap：

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

如果 `fallocate` 失败，可以改用：

```bash
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

## 4. 安装 Node.js

推荐安装 Node.js 22 LTS：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

node -v
npm -v
```

确认 `node -v` 输出为 `v22.x` 或至少 `v20.x`。

## 5. 安装 PostgreSQL

Ubuntu 24.04 默认提供 PostgreSQL 16：

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql

psql --version
```

创建数据库和数据库用户：

```bash
sudo -iu postgres psql
```

进入 PostgreSQL 后执行：

```sql
CREATE USER todolist_user WITH PASSWORD 'Tong15963';
CREATE DATABASE todolist OWNER todolist_user;
\c todolist
CREATE SCHEMA IF NOT EXISTS public AUTHORIZATION todolist_user;
GRANT ALL ON SCHEMA public TO todolist_user;
\q
```

数据库默认只需要本机访问，不要把 `5432` 暴露到公网。

## 6. 部署项目代码

创建部署用户和项目目录：

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /var/www/todolist
sudo chown -R deploy:deploy /var/www/todolist
```

切换到部署用户：

```bash
sudo -iu deploy
```

拉取代码，按你的实际仓库地址替换：

```bash
git clone https://github.com/BeingTowardsDeath/todolist.git /var/www/todolist
cd /var/www/todolist
```

如果你是上传源码包，把源码解压到 `/var/www/todolist` 即可。

## 7. 配置环境变量

在项目根目录创建 `.env`：

```bash
cd /var/www/todolist
vi .env
```

写入：

```env
DATABASE_URL="postgresql://todolist_user:替换成URL编码后的密码@localhost:5432/todolist?schema=public"
SESSION_COOKIE_SECURE="false"
```
 只用于“公网 IP + HTTP”部署。以后改成域名 + HTTPS 后，建议删除这一行，或改成：
DATABASE_URL="postgresql://todolist_user:Tong15963@localhost:5432/todolist?schema=public"
SESSION_COOKIE_SECURE="false"
```env
SESSION_COOKIE_SECURE="true"
```

如果密码包含特殊字符，需要做 URL 编码。常见字符示例：

- `@` 编码为 `%40`
- `#` 编码为 `%23`
- `%` 编码为 `%25`
- `/` 编码为 `%2F`
- `:` 编码为 `%3A`

例如数据库密码是 `My@Pass#123`，则：

```env
DATABASE_URL="postgresql://todolist_user:My%40Pass%23123@localhost:5432/todolist?schema=public"
SESSION_COOKIE_SECURE="false"
```

## 8. 安装依赖、迁移数据库并构建

在项目目录执行：

```bash
cd /var/www/todolist

npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

不要在生产环境执行：

```bash
npx prisma db seed
```

当前项目的 `prisma/seed.ts` 会清空工作区数据，只适合明确需要重置数据时手动执行。

## 9. 使用 PM2 托管应用

安装 PM2：

```bash
sudo npm install -g pm2
```

用 `deploy` 用户启动应用：

```bash
sudo -iu deploy
cd /var/www/todolist

pm2 start npm --name todolist --cwd /var/www/todolist -- run start
pm2 save
pm2 startup systemd -u deploy --hp /home/deploy
```

`pm2 startup` 会输出一条需要 `sudo` 执行的命令，复制执行一次即可。

检查运行状态：

```bash
pm2 status
pm2 logs todolist
curl -I http://127.0.0.1:3001
```

如果 `curl` 返回 `200`、`307` 或其他 Next.js 正常响应，说明 Node 服务已启动。

## 10. 配置 Nginx 反向代理

Ubuntu 的 Nginx 推荐使用 `sites-available` 和 `sites-enabled`：

```bash
sudo vi /etc/nginx/sites-available/todolist
```

写入以下内容，把 `203.0.113.10` 替换为你的 VPS 公网 IP：

```nginx
server {
    listen 80;
    server_name 203.0.113.10;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

启用站点并关闭默认站点：

```bash
sudo ln -sfn /etc/nginx/sites-available/todolist /etc/nginx/sites-enabled/todolist
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

此时可以访问：

```text
http://203.0.113.10
```

如果访问不到，先确认云厂商安全组和 UFW 都放行了 `80` 端口。

## 11. 只有公网 IP 时的 HTTPS 说明

没有域名时，可以先跳过 HTTPS。公网 IP 部署的关键配置是：

```env
SESSION_COOKIE_SECURE="false"
```

这样浏览器可以在 `http://公网IP` 下保存登录 Cookie。

注意：

- HTTP 明文传输不适合放敏感数据。
- 不建议把数据库端口 `5432` 暴露到公网。
- 以后有域名后，应配置 HTTPS，并把 `SESSION_COOKIE_SECURE` 改回 `true` 或直接删除该环境变量。

如果以后有域名，例如 `todo.example.com`，可以按下面方式签发 HTTPS 证书：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d todo.example.com
```

按提示选择开启 HTTP 到 HTTPS 的自动跳转，然后测试证书自动续期：

```bash
sudo certbot renew --dry-run
```

## 12. 首次验证

部署完成后按顺序验证：

```bash
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql
curl -I http://203.0.113.10
```

浏览器访问 `http://203.0.113.10` 后：

1. 注册一个账号。
2. 登录。
3. 新增一条 Todo。
4. 刷新页面，确认登录状态和数据仍然存在。

如果登录后刷新变成未登录，优先检查 `.env` 中是否设置了 `SESSION_COOKIE_SECURE="false"`，然后执行：

```bash
pm2 restart todolist --update-env
```

## 13. 后续更新流程

每次发布新版本时执行：

```bash
sudo -iu deploy
cd /var/www/todolist

git pull
npm ci --include=dev
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart todolist --update-env
pm2 logs todolist
```

如果更新包含数据库结构变更，建议先备份数据库。

如果二次部署前需要明确停止当前运行的程序，可以先执行：

```bash
pm2 stop todolist
```

普通更新通常不需要先停止程序，直接在构建完成后执行 `pm2 restart todolist --update-env` 即可。只有在数据库恢复、端口冲突排查、旧进程异常或需要临时下线服务时，才建议先手动停止。

## 14. 自动化部署

推荐使用 GitHub Actions 触发 VPS 上的部署脚本。首次部署仍然按前面的步骤手动完成；自动化部署只负责后续发布新版本。

### 14.1 创建服务器部署脚本

用 `deploy` 用户在服务器创建部署脚本：

```bash
sudo -iu deploy
cd /var/www/todolist
vi deploy.sh
```

写入：

```bash
#!/usr/bin/env bash
set -euo pipefail

cd /var/www/todolist

git fetch origin
git reset --hard origin/main

npm ci
npx prisma generate
npx prisma migrate deploy
npm run build

pm2 restart todolist --update-env || pm2 start npm --name todolist --cwd /var/www/todolist -- run start
pm2 save
```

授权执行：

```bash
chmod +x /var/www/todolist/deploy.sh
```

如果你的主分支不是 `main`，把脚本中的 `origin/main` 改成实际分支，例如 `origin/master`。

### 14.2 配置服务器拉取代码权限

如果仓库是公开仓库，服务器通常可以直接 `git fetch`。

如果仓库是私有仓库，建议给 `deploy` 用户配置 GitHub Deploy Key：

```bash
sudo -iu deploy
ssh-keygen -t ed25519 -C "todolist-vps-deploy"
cat ~/.ssh/id_ed25519.pub
```

把输出的公钥添加到 GitHub 仓库：

```text
Settings -> Deploy keys -> Add deploy key
```

只需要勾选读权限，不需要勾选写权限。然后在服务器测试：

```bash
cd /var/www/todolist
git fetch origin
```

### 14.3 配置 GitHub Secrets

在 GitHub 仓库中打开：

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

添加以下 Secrets：

```text
VPS_HOST=你的服务器公网IP
VPS_USER=deploy
VPS_PORT=22
VPS_SSH_KEY=deploy 用户 SSH 私钥内容
```

`VPS_SSH_KEY` 应填写 GitHub Actions 用来登录服务器的私钥。建议单独生成一组部署专用 SSH key，不要使用你个人常用私钥。

### 14.4 添加 GitHub Actions 工作流

在本地项目中新建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            /var/www/todolist/deploy.sh
```

如果你的主分支不是 `main`，同步修改 `branches`。

提交并推送后，每次推送到 `main` 都会自动部署：

```bash
git add .github/workflows/deploy.yml
git commit -m "Add automated deployment workflow"
git push origin main
```

### 14.5 自动化部署后的检查

在 GitHub Actions 页面确认工作流执行成功，然后在服务器检查：

```bash
pm2 status
pm2 logs todolist
curl -I http://127.0.0.1:3001
```

浏览器访问：

```text
http://公网IP
```

注意：

- 生产环境自动部署只执行 `npx prisma migrate deploy`，不要自动执行 `npx prisma db seed`。
- `.env` 只保存在服务器，不要提交到 Git 仓库。
- 如果本次发布包含数据库结构变更，建议先按下一节备份数据库。
- 如果 GitHub Actions 能登录服务器但部署失败，优先查看 Actions 日志和 `pm2 logs todolist`。

## 15. 数据库备份与恢复

创建备份目录：

```bash
sudo mkdir -p /var/backups/todolist
sudo chown deploy:deploy /var/backups/todolist
```

手动备份：

```bash
PGPASSWORD='数据库密码' pg_dump \
  -h localhost \
  -U todolist_user \
  -d todolist \
  -Fc \
  -f "/var/backups/todolist/todolist_$(date +%F_%H%M).dump"
```

恢复备份前建议先停应用：

```bash
pm2 stop todolist
```

恢复：

```bash
PGPASSWORD='数据库密码' pg_restore \
  -h localhost \
  -U todolist_user \
  -d todolist \
  --clean \
  --if-exists \
  "/var/backups/todolist/你的备份文件.dump"
```

恢复后启动应用：

```bash
pm2 start todolist
```

## 16. 常见问题

### 502 Bad Gateway

检查应用是否在运行：

```bash
pm2 status
pm2 logs todolist
curl -I http://127.0.0.1:3001
```

检查 Nginx：

```bash
sudo nginx -t
sudo tail -n 100 /var/log/nginx/error.log
sudo systemctl reload nginx
```

### Prisma 提示 DATABASE_URL 未设置

确认 `/var/www/todolist/.env` 存在，并且 PM2 是从 `/var/www/todolist` 目录启动：

```bash
pm2 describe todolist
cat /var/www/todolist/.env
```

修改 `.env` 后重启：

```bash
pm2 restart todolist --update-env
```

### 数据库连接失败

检查 PostgreSQL 状态：

```bash
sudo systemctl status postgresql
sudo -iu postgres psql -c '\l'
```

检查连接串中的密码是否做了 URL 编码，尤其是 `@`、`#`、`%` 等字符。

### 登录后刷新变成未登录

如果只有公网 IP 并使用 HTTP，确认 `.env` 中有：

```env
SESSION_COOKIE_SECURE="false"
```

修改后重启：

```bash
pm2 restart todolist --update-env
```

确认访问地址是：

```text
http://公网IP
```

不要直接使用 `http://公网IP:3001` 对外访问，统一通过 Nginx 的 `80` 端口访问。

如果已经配置了域名和 HTTPS，则应使用 `https://你的域名`，并把 `SESSION_COOKIE_SECURE` 改回 `true` 或删除该环境变量。

### 端口冲突

当前 `package.json` 中启动命令是：

```json
"start": "next start -p 3001"
```

如果要换端口，需要同时修改：

- `package.json` 的 `start` 脚本
- Nginx 中的 `proxy_pass http://127.0.0.1:3001`
- PM2 重启应用
