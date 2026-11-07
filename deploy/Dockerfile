# ============================================================
#  Stage 1: Build
# ============================================================
FROM node:22-slim AS builder

WORKDIR /app

# 安装构建依赖（better-sqlite3 native 编译需要 python3/make/g++；git 用于部分 npm 包）
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖清单
COPY package.json package-lock.json* ./

# 安装依赖（跳过 postinstall 避免非交互阻塞）
RUN npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts
RUN npm rebuild better-sqlite3 2>/dev/null || true

# 复制源码
COPY . .

# 清理可能从构建上下文带入的依赖和构建产物，确保干净构建
RUN rm -rf node_modules dist

# 分步构建 server + client（不走 build.sh 整体脚本避免交互问题）
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build:server \
    && NODE_OPTIONS="--max-old-space-size=4096" npm run build:client

# ============================================================
#  Stage 2: Production Runtime
# ============================================================
FROM node:22-slim AS runtime

# 运行时依赖：curl（健康检查）、tini（信号处理）、ca-certificates（HTTPS 请求）
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl tini ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/dist ./dist
# 复制 package.json（运行时依赖重新安装用）
COPY --from=builder /app/package.json ./package.json
# 复制 package-lock.json 以加速安装（如果存在）
COPY --from=builder /app/package-lock.json* ./

# 安装生产依赖（只装 dependencies，不含 devDependencies）
RUN npm install --omit=dev --ignore-scripts 2>/dev/null \
    || npm install --production --ignore-scripts 2>/dev/null \
    || true
RUN npm rebuild better-sqlite3 2>/dev/null || true

# 清理不需要的缓存
RUN npm cache clean --force 2>/dev/null || true

# 环境变量
# - SERVER_HOST=0.0.0.0：容器内必须监听所有网卡
# - SERVER_PORT=3002：后端服务端口
# - PORT=3002：端口变量别名
# - DATA_DIR=/app/data：数据目录（数据库文件）
ENV DATA_DIR=/app/data \
    SERVER_HOST=0.0.0.0 \
    SERVER_PORT=3002 \
    PORT=3002 \
    NODE_ENV=production

# 创建数据目录并授权 node 用户
RUN mkdir -p /app/data && chown -R node:node /app/data

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://localhost:3002/" > /dev/null || exit 1

EXPOSE 3002

# 非 root 用户
USER node

VOLUME ["/app/data"]

# 启动：从项目根运行 dist/server/main.js（与开发模式 cwd 约定一致）
# views 路径：process.cwd() + 'dist/client' = /app/dist/client
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server/main.js"]
