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
# - python3 / make / g++：better-sqlite3 回退到源码编译时需要
# - git：部分 npm 包从 git 拉取
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi

# 依赖清单单独 COPY，命中缓存
COPY package.json package-lock.json* ./

# 去掉项目自带的 postinstall/prepare：
# postinstall 调用 fullstack-cli（生成器带的 CLI），容器里没有也不该跑
RUN npm pkg delete scripts.postinstall scripts.prepare || true

# 注意：这里**不能**加 --ignore-scripts。
# --ignore-scripts 会让 @swc/core、esbuild 这类包跳过安装脚本，
# 平台二进制（@swc/core-linux-x64-gnu 等）装不上，
# 构建时直接报 "Failed to load native binding"。
RUN npm ci --no-audit --no-fund

# better-sqlite3 兜底：预编译包拉不到时在这里按源码编译
RUN npm rebuild better-sqlite3 --no-audit --no-fund || true

# 拷贝源码（.dockerignore 已排除 node_modules / dist / data / .env）
COPY . .

# 前端包体较大（ECharts / Tailwind 等），默认堆内存容易 OOM，显式放大
ENV NODE_OPTIONS=--max-old-space-size=4096

# 前后端分开两条 RUN，失败时能一眼看出是哪一步挂了
RUN npm run build:server
RUN npm run build:client

# 剔除开发依赖，保留编译好的生产依赖
RUN npm prune --omit=dev --no-audit --no-fund

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
