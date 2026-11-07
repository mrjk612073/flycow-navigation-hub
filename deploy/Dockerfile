# Compass 导航起始页 - 单镜像部署
# 端口固定 3002，数据落在 /app/data
FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    SERVER_HOST=0.0.0.0 \
    SERVER_PORT=3002 \
    PORT=3002 \
    DATA_DIR=/app/data \
    TZ=Asia/Shanghai

# 先装依赖，利用镜像层缓存
COPY package*.json ./
RUN npm install --no-audit --no-fund

# 拷入源码并构建前后端
COPY . .
RUN npm run build:server \
 && npm run build:client \
 && npm prune --omit=dev

# 数据目录（数据库 + 上传的壁纸）
RUN mkdir -p /app/data \
 && chown -R node:node /app

USER node
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.SERVER_PORT||3002)+'/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/server/main.js"]
