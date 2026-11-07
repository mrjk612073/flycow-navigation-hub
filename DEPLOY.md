# 导航页 - 部署指南

一款面向个人/家庭的浏览器起始页，支持壁纸 API、内外网自动切换、多端自适应。单容器部署，数据全部存在 SQLite 文件里，迁移只需打包一个目录。

---

## 快速启动

### 方式一：Docker Compose（推荐）

```bash
# 从项目根进入 deploy 目录
cd deploy

# 构建并启动
docker compose up -d --build

# 查看日志
docker compose logs -f

# 停止
docker compose down
```

启动后访问：**http://localhost:3002**

### 方式二：纯 Docker 命令

```bash
# 在项目根目录构建镜像
docker build -f deploy/Dockerfile -t compass-nav .

# 运行
docker run -d \
  --name compass-nav \
  --restart unless-stopped \
  -p 3002:3002 \
  -v $(pwd)/data:/app/data \
  -e SERVER_PORT=3002 \
  -e SERVER_HOST=0.0.0.0 \
  -e DATA_DIR=/app/data \
  -e NODE_ENV=production \
  compass-nav
```

---

## 飞牛 NAS 部署步骤

### 前置准备

- 飞牛 NAS 已安装并启用 Docker（容器管理）
- 能通过文件管理器操作 + Compose 项目面板，或开启了 SSH

### 方法 A：Compose 项目面板（推荐，图形化）

1. **下载项目源码到 NAS**
   - 把整个项目目录上传到 NAS（例如 `/docker/compass-nav/`）
   - 可以用 scp、rsync、飞牛文件管理器上传，或直接 git clone

2. **确认目录结构**
   ```
   compass-nav/              # 项目根目录
   ├── deploy/               # 部署文件
   │   ├── Dockerfile
   │   ├── .dockerignore
   │   └── docker-compose.yml
   ├── client/               # 前端源码
   ├── server/               # 后端源码
   └── data/                 # 运行后自动生成（数据库等）
   ```

3. **在 Compose 项目面板导入**
   - 打开「Docker」→「Compose」→「新建项目」
   - 项目名称：`compass-nav`
   - 路径：选择 `deploy` 目录（或直接选择 `docker-compose.yml` 文件）
   - 点击「确定」，飞牛会自动构建镜像并启动容器

4. **放行端口**
   - 打开「网络与安全」→「防火墙」→ 放行 TCP 3002 端口
   - 或在 Docker 面板里确认端口映射已正确绑定

5. **访问**
   - 浏览器打开 `http://<NAS内网IP>:3002`

### 方法 B：SSH 命令行

```bash
# 1. SSH 登录飞牛 NAS
ssh admin@<NAS-IP>

# 2. 上传源码（或 git clone）
# scp -r ./compass-nav admin@<NAS-IP>:/volume1/docker/

# 3. 进入部署目录并启动
cd /volume1/docker/compass-nav/deploy
docker compose up -d --build

# 4. 查看状态
docker compose ps
docker compose logs -f --tail=50
```

---

## 数据目录与持久化

### 目录结构

```
data/                     # 挂载到容器内 /app/data
└── compass.db            # SQLite 数据库（全部数据：卡片、分组、壁纸、设置、用户等）
```

> 当前版本壁纸以 URL 形式存储（含 data-URI 内联图），没有单独的文件上传目录。后续如开启文件上传功能，会自动在 `data/` 下创建子目录。

### 备份

直接打包整个 `data/` 目录即可：

```bash
# 备份（建议先停止容器，或确保写入空闲）
docker stop compass-nav
tar -czf compass-nav-backup-$(date +%Y%m%d).tar.gz data/
docker start compass-nav
```

### 迁移 / 恢复

```bash
# 在新机器上解压备份
tar -xzf compass-nav-backup-20240101.tar.gz

# 正常启动 compose，数据自动恢复
docker compose up -d --build
```

### 升级

```bash
# 拉取/构建新版镜像并重启，数据目录不受影响
cd deploy
docker compose up -d --build
```

---

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `SERVER_PORT` | `3002` | HTTP 监听端口。容器内固定 3002，需要改端口请修改 compose 端口映射的左侧 |
| `SERVER_HOST` | `0.0.0.0` | 监听地址。Docker 环境必须是 `0.0.0.0`，否则容器外不可达 |
| `DATA_DIR` | `/app/data` | 数据目录（数据库文件所在路径），容器内固定 `/app/data` |
| `NODE_ENV` | `production` | 运行模式，生产环境保持 `production` |
| `PORT` | `3002` | 端口别名，与 `SERVER_PORT` 二选一即可 |
| `JWT_SECRET` | _内置默认_ | JWT 签名密钥。**生产环境强烈建议自定义**，至少 32 位随机字符串 |

> 修改环境变量后重启容器生效：`docker compose restart`

---

## 首次初始化

1. **访问首页**：打开 `http://<你的地址>:3002`，应该能看到时钟和默认导航卡片
2. **进入编辑模式**：
   - 点击页面上的「设置 / 编辑」按钮
   - 默认编辑密码：**admin123**（进入设置面板后请立即修改）
3. **注册管理员账号**（可选）：
   - 编辑密码模式下可以直接编辑公共数据
   - 如需多用户体系，可在设置中注册管理员账号，然后用管理员登录管理普通用户
4. **修改编辑密码**：设置 → 安全 → 修改编辑密码
5. **添加你的导航卡片**：设置 → 导航卡片 → 新增

---

## 常见问题

### 端口 3002 被占用了怎么办？

修改 `docker-compose.yml` 的端口映射（**只改左边**，容器内部端口始终是 3002）：

```yaml
ports:
  - "8080:3002"   # 左边改成你想要的宿主机端口
```

然后 `docker compose up -d` 重启即可。

### 数据目录权限错误

如果容器启动后报 `permission denied` 或数据库打不开：

```bash
# 检查宿主机 data 目录的权限
ls -la data/

# 如果属主是 root，改一下（容器内用 node 用户，UID 通常是 1000）
sudo chown -R 1000:1000 data/

# 或者直接给读写权限（简单，家庭环境可用）
chmod -R 777 data/
```

### 壁纸上传失败 / 壁纸 API 不显示

- **在线壁纸 API**：由后端代理请求，检查容器能否访问外网
  ```bash
  docker exec compass-nav curl -I https://www.example.com
  ```
- **壁纸 URL**：壁纸以 URL 形式存储，URL 必须能被浏览器直接访问
- 飞牛 NAS 如果在内网且没有外网访问权限，在线壁纸 API 功能会不可用，自动回退到本地壁纸

### 反向代理与域名访问（外网访问配置）

通过飞牛的反向代理或 Nginx 将域名指到 `http://127.0.0.1:3002`。

**Nginx 反向代理示例：**

```nginx
server {
    listen 80;
    server_name nav.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Cookie 需要正确的 domain/path，反向代理时保持默认即可
        proxy_cookie_path / /;

        # 超时（壁纸 API 代理可能稍慢）
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

**HTTPS（强烈建议）：**
- 使用飞牛内置的反向代理 + 自动证书（如果支持），或用自己的 Nginx + Let's Encrypt
- 开启 HTTPS 后，内外网切换功能会根据当前域名自动识别环境并切换卡片 URL

**关于 WebSocket / 长连接：**
- 本应用是纯 HTTP 应用，没有 WebSocket / SSE 长连接，反向代理无需额外配置

---

## 飞牛 FPK 打包说明

飞牛 NAS 支持 **FPK 应用包** 格式（`.fpk`），可以把应用上架到飞牛应用中心、一键安装。

### FPK vs Docker Compose 怎么选？

| 维度 | Docker Compose | FPK 应用包 |
|------|---------------|-----------|
| 上手难度 | 低，直接写 compose | 需要了解 FPK 规范 |
| 可视化安装 | 需手动操作 compose | 应用中心一键安装 |
| 更新方式 | 手动 rebuild | 应用中心版本管理 |
| 配置界面 | 手动改环境变量 | 可在安装界面填写配置 |
| 分享给他人 | 发代码包 | 发一个 fpk 文件 |

**推荐：**
- 自己用、给家人用 → **Docker Compose**，简单直接
- 想发布到飞牛应用中心、或做一键安装包 → **FPK**

### FPK 目录结构建议

```
compass-nav.fpk/          # 解压后的目录，打包成 zip 改后缀为 .fpk
├── app/
│   ├── manifest.json     # 应用描述（名称、版本、图标、作者等）
│   ├── docker-compose.yml  # 容器编排定义（基于 deploy/docker-compose.yml 调整）
│   ├── icon.png          # 应用图标（建议 256x256 PNG）
│   └── README.md         # 应用说明
└── config/               # 可选：安装时的配置项定义
    └── settings.json     # 配置表单（端口、JWT密钥等）
```

**manifest.json 核心字段（示例，以飞牛官方规范为准）：**

```json
{
  "name": "compass-nav",
  "version": "1.0.0",
  "title": "导航页",
  "description": "精美的浏览器起始页，支持壁纸 API、内外网切换、多端自适应",
  "author": "Your Name",
  "category": "utilities",
  "icon": "icon.png",
  "architecture": ["x86_64", "arm64"],
  "minFnOsVersion": "7.0.0",
  "ports": [
    { "containerPort": 3002, "protocol": "tcp", "defaultHostPort": 3002, "name": "web" }
  ],
  "volumes": [
    { "containerPath": "/app/data", "name": "data", "description": "数据库与数据文件" }
  ],
  "env": [
    { "key": "JWT_SECRET", "value": "", "description": "JWT 密钥（留空使用默认，建议自定义）", "type": "string", "optional": true }
  ]
}
```

> 飞牛 FPK 的具体规范以飞牛官方文档为准，不同版本字段可能有差异。FPK 的 docker-compose.yml 和本项目 `deploy/docker-compose.yml` 内容基本一致，主要是数据卷和网络部分按 FPK 规范调整。

---

## 容器管理常用命令

```bash
# 查看状态
docker compose ps

# 查看实时日志
docker compose logs -f

# 查看最近 100 行日志
docker compose logs --tail=100

# 重启
docker compose restart

# 停止并删除容器（数据不会丢，在 volume 里）
docker compose down

# 重新构建并启动
docker compose up -d --build

# 进入容器调试
docker compose exec compass-nav bash
```

---

## 性能与资源占用

- **镜像大小**：约 400-500MB（基于 node:22-slim，含 better-sqlite3 native 模块）
- **内存占用**：运行时约 80-120MB
- **CPU**：空闲时接近 0，壁纸 API 请求时短暂上升
- **磁盘**：应用本身 ~400MB，数据目录取决于壁纸数量（URL 存储占用极小）

> ARM 设备（飞牛 NAS 常见的 ARM64 架构）也能正常运行，Node.js 官方镜像支持 arm64。
