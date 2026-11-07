# ============================================================
#  Stage 1: Build
# ============================================================
# 基础镜像默认走国内可匿名拉取的镜像仓库（docker.io 在部分网络环境不可达）
# 如需换源：docker build --build-arg NODE_IMAGE=node:22-slim
ARG NODE_IMAGE=docker.m.daocloud.io/library/node:22-slim
# npm 源，默认国内镜像；纯海外环境可传 --build-arg NPM_REGISTRY=
ARG NPM_REGISTRY=https://registry.npmmirror.com

FROM ${NODE_IMAGE} AS builder

ARG NODE_IMAGE
ARG NPM_REGISTRY

WORKDIR /app

# 构建依赖：
# - python3 / make / g++：better-sqlite3 原生模块编译
# - git：部分 npm 包从 git 拉取
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi

# 依赖清单单独 COPY，命中缓存
COPY package.json package-lock.json* ./

# 先按 lock 安装；--ignore-scripts 避免 postinstall 阻塞，原生模块随后单独 rebuild
RUN npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts
RUN npm rebuild better-sqlite3 2>/dev/null || true

# 拷贝源码（.dockerignore 已排除 node_modules / dist / data / .env）
COPY . .

# 构建前后端
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build:server \
    && NODE_OPTIONS="--max-old-space-size=4096" npm run build:client

# 剔除开发依赖，保留已编译好的生产依赖（含 better-sqlite3 二进制）
RUN npm prune --omit=dev

# ============================================================
#  Stage 2: Production Runtime
# ============================================================
FROM ${NODE_IMAGE} AS runtime

ARG NODE_IMAGE

# 运行时依赖：curl（健康检查）、tini（PID 1 信号处理）、ca-certificates（HTTPS 请求）
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl tini ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 直接搬构建阶段的产物和依赖，运行时不再装包、不再编译
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# 环境变量
# - SERVER_HOST=0.0.0.0：容器内必须监听所有网卡
# - SERVER_PORT=3002：后端服务端口
# - PORT=3002：端口变量别名
# - DATA_DIR=/app/data：数据目录（数据库文件与上传壁纸）
ENV DATA_DIR=/app/data \
    SERVER_HOST=0.0.0.0 \
    SERVER_PORT=3002 \
    PORT=3002 \
    NODE_ENV=production

# 创建数据目录并授权 node 用户（命名卷首次挂载会继承这里的属主）
RUN mkdir -p /app/data && chown -R node:node /app

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://localhost:3002/" > /dev/null || exit 1

EXPOSE 3002

# 非 root 用户
USER node

VOLUME ["/app/data"]

# 启动：从项目根运行 dist/server/main.js
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server/main.js"]
