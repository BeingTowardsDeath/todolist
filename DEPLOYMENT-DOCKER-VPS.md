# Docker 镜像上传 VPS 部署说明

本文档按“本地构建 Docker 镜像 -> 上传到 VPS -> VPS 运行容器”的方式部署 `todolist` 项目。原有部署文档保留不变，本文件只说明 Docker 交付流程。

适用场景：
- 本地机器可以安装并运行 Docker。
- VPS 不想安装 Node.js、npm、Prisma 等构建环境。
- PostgreSQL 可以和应用一起运行在 VPS 的 Docker Compose 中。
- 暂时只有公网 IP，没有域名和 HTTPS。

项目运行信息：
- 应用端口：`3001`
- 对外访问端口：`80`
- 数据库：PostgreSQL
- 推荐本地构建环境：Docker Desktop 或 Docker Engine
- 推荐 VPS 系统：Ubuntu 24.04 LTS

> 只有公网 IP 且使用 HTTP 时，需要设置 `SESSION_COOKIE_SECURE=false`，否则生产环境登录 Cookie 可能无法保存。有域名并配置 HTTPS 后，再改为 `SESSION_COOKIE_SECURE=true`。

## 1. 总体流程

1. 本地项目根目录新增 Docker 构建文件。
2. 本地执行 `docker build` 生成镜像。
3. 本地执行 `docker save` 导出镜像包。
4. 使用 `scp` 将镜像包上传到 VPS。
5. VPS 执行 `docker load` 导入镜像。
6. VPS 使用 `docker compose up -d` 启动应用和 PostgreSQL。
7. Nginx 将公网 `80` 端口反向代理到应用容器。

## 2. 本地准备 Dockerfile

在项目根目录创建 `Dockerfile`：

```dockerfile
FROM node:22-alpine

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci --include=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
```

说明：
- 镜像构建时会安装依赖、生成 Prisma Client、执行 Next.js 构建。
- 容器启动时会先执行 `npx prisma migrate deploy`，再启动应用。
- 这个方案镜像会比极限精简方案大一些，但部署简单，VPS 不需要 Node 构建环境。
- 不要在生产启动命令中执行 `npx prisma db seed`，当前 seed 逻辑只适合明确重置数据时手动使用。

在项目根目录创建 `.dockerignore`：

```dockerignore
.git
.next
node_modules
npm-debug.log*
.env
.env.*
Dockerfile
docker-compose.yml
DEPLOYMENT-*.md
recreated_image_table.xlsx
tsconfig.tsbuildinfo
```

## 3. 本地构建并导出镜像

在本地项目根目录执行。

Windows PowerShell：

```powershell
$Tag = "todolist:$(Get-Date -Format yyyyMMdd-HHmm)"
docker build -t $Tag .
docker save $Tag -o .\todolist-image.tar
Write-Host "Built image: $Tag"
```

Linux/macOS：

```bash
TAG="todolist:$(date +%Y%m%d-%H%M)"
docker build -t "$TAG" .
docker save "$TAG" -o ./todolist-image.tar
echo "Built image: $TAG"
```

构建前建议先在本地跑一次校验：

```bash
npm run lint
npm run build
```

如果本地没有 Node 环境，也可以只依赖 `docker build`，因为镜像构建过程会执行项目构建。

## 4. 上传镜像到 VPS

把 `203.0.113.10` 替换成你的 VPS 公网 IP。

先在 VPS 创建目录：

```bash
ssh root@203.0.113.10 "mkdir -p /opt/todolist"
```

Windows PowerShell：

```powershell
scp .\todolist-image.tar root@203.0.113.10:/opt/todolist/todolist-image.tar
```

Linux/macOS：

```bash
scp ./todolist-image.tar root@203.0.113.10:/opt/todolist/todolist-image.tar
```

## 5. VPS 安装 Docker 和 Nginx

登录 VPS：

```bash
ssh root@203.0.113.10
```

安装基础组件：

```bash
apt update
apt upgrade -y
apt install -y ca-certificates curl gnupg nginx ufw
```

安装 Docker 官方源：

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

确认版本：

```bash
docker --version
docker compose version
```

配置防火墙：

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw --force enable
ufw status
```

> 不要把 PostgreSQL 的 `5432` 端口暴露到公网。

## 6. VPS 导入镜像

```bash
cd /opt/todolist
docker load -i todolist-image.tar
docker images | grep todolist
```

记下镜像名和标签，例如：

```text
todolist   20260616-1030
```

完整镜像名就是：

```text
todolist:20260616-1030
```

## 7. VPS 创建环境变量文件

在 `/opt/todolist/.env` 写入：

```bash
cd /opt/todolist
nano .env
```

示例内容：

```env
APP_IMAGE=todolist:20260616-1030
POSTGRES_DB=todolist
POSTGRES_USER=todolist_user
POSTGRES_PASSWORD=ChangeThisPassword123
DATABASE_URL=postgresql://todolist_user:ChangeThisPassword123@db:5432/todolist?schema=public
SESSION_COOKIE_SECURE=false
```

注意：
- `APP_IMAGE` 必须改成 `docker load` 后实际存在的镜像标签。
- 如果数据库密码包含 `@`、`#`、`%`、`/`、`:` 等特殊字符，`DATABASE_URL` 里的密码必须做 URL 编码。
- 为了减少出错，生产首次部署建议先使用字母和数字组合的强密码。

常见 URL 编码：

```text
@ -> %40
# -> %23
% -> %25
/ -> %2F
: -> %3A
```

## 8. VPS 创建 docker-compose.yml

在 `/opt/todolist/docker-compose.yml` 写入：

```bash
cd /opt/todolist
nano docker-compose.yml
```

内容：

```yaml
services:
  app:
    image: ${APP_IMAGE}
    container_name: todolist-app
    restart: unless-stopped
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "127.0.0.1:3001:3001"

  db:
    image: postgres:16-alpine
    container_name: todolist-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - todolist-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 20

volumes:
  todolist-postgres-data:
```

这里把应用只绑定到 `127.0.0.1:3001`，公网只通过 Nginx 的 `80` 端口访问。

## 9. 启动服务

```bash
cd /opt/todolist
docker compose up -d
```

检查状态：

```bash
docker compose ps
docker logs -f todolist-app
```

验证应用本机响应：

```bash
curl -I http://127.0.0.1:3001
```

返回 `200`、`307` 或其他 Next.js 正常响应，都说明应用已启动。

## 10. 配置 Nginx 反向代理

创建 Nginx 配置：

```bash
nano /etc/nginx/sites-available/todolist
```

内容，把 `203.0.113.10` 替换成你的 VPS 公网 IP：

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

启用站点：

```bash
ln -sfn /etc/nginx/sites-available/todolist /etc/nginx/sites-enabled/todolist
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

浏览器访问：

```text
http://203.0.113.10
```

首次验证：
1. 注册账号。
2. 登录。
3. 新增一条 Todo。
4. 刷新页面，确认登录状态和数据仍然存在。

## 11. 后续更新流程

本地重新构建镜像：

Windows PowerShell：

```powershell
$Tag = "todolist:$(Get-Date -Format yyyyMMdd-HHmm)"
docker build -t $Tag .
docker save $Tag -o .\todolist-image.tar
Write-Host "Built image: $Tag"
```

上传到 VPS：

```powershell
scp .\todolist-image.tar root@203.0.113.10:/opt/todolist/todolist-image.tar
```

VPS 导入新镜像：

```bash
cd /opt/todolist
docker load -i todolist-image.tar
docker images | grep todolist
```

修改 `/opt/todolist/.env`：

```env
APP_IMAGE=todolist:新的标签
```

重启应用：

```bash
cd /opt/todolist
docker compose up -d
docker logs -f todolist-app
```

如果新版本包含 Prisma 迁移，应用容器启动时会自动执行：

```bash
npx prisma migrate deploy
```

发布前建议先备份数据库。

## 12. 备份和恢复数据库

创建备份目录：

```bash
mkdir -p /opt/todolist/backups
```

备份：

```bash
cd /opt/todolist
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "/opt/todolist/backups/todolist_$(date +%F_%H%M).dump"
```

恢复前先停止应用：

```bash
cd /opt/todolist
docker compose stop app
```

恢复：

```bash
docker compose exec -T db pg_restore \
  -U todolist_user \
  -d todolist \
  --clean \
  --if-exists \
  < /opt/todolist/backups/你的备份文件.dump
```

恢复后启动应用：

```bash
docker compose up -d app
```

## 13. HTTPS 说明

只有公网 IP 时，通常先使用：

```env
SESSION_COOKIE_SECURE=false
```

以后有域名后，例如 `todo.example.com`，可以签发 HTTPS 证书：

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d todo.example.com
certbot renew --dry-run
```

然后把 `/opt/todolist/.env` 改为：

```env
SESSION_COOKIE_SECURE=true
```

重启应用：

```bash
cd /opt/todolist
docker compose up -d
```

## 14. 常见问题

### 502 Bad Gateway

检查应用容器：

```bash
docker compose ps
docker logs --tail=200 todolist-app
curl -I http://127.0.0.1:3001
```

检查 Nginx：

```bash
nginx -t
tail -n 100 /var/log/nginx/error.log
systemctl reload nginx
```

### Prisma 提示 DATABASE_URL 未设置

检查 `/opt/todolist/.env`：

```bash
cd /opt/todolist
cat .env
docker compose config
docker compose up -d
```

### 数据库连接失败

检查数据库容器：

```bash
docker logs --tail=200 todolist-db
docker compose ps
```

检查 `DATABASE_URL` 是否使用了 Compose 服务名 `db`：

```env
DATABASE_URL=postgresql://todolist_user:密码@db:5432/todolist?schema=public
```

容器内部不能使用 `localhost` 连接数据库，因为 `localhost` 指的是应用容器本身。

### 登录后刷新变成未登录

只有公网 IP 且使用 HTTP 时，确认：

```env
SESSION_COOKIE_SECURE=false
```

修改后重启：

```bash
cd /opt/todolist
docker compose up -d
```

### 更新后还是旧版本

确认 `.env` 中的 `APP_IMAGE` 已经改成新标签：

```bash
cd /opt/todolist
cat .env
docker images | grep todolist
docker compose up -d --force-recreate app
```

### 清理旧镜像

确认新版本运行正常后，可以清理未使用镜像：

```bash
docker image prune -f
```

不要删除 PostgreSQL 数据卷。数据卷名通常是：

```text
todolist_todolist-postgres-data
```
