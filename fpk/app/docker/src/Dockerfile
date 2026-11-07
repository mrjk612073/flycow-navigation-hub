# Compass 导航起始页 - 单镜像部署（端口 3002）
# 用法：把应用源码解压到本目录（app/docker/src/），与这个 Dockerfile 同级
FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    SERVER_HOST=0.0.0.0 \
    SERVER_PORT=3002 \
    PORT=3002 \
    DATA_DIR=/app/data \
    TZ=Asia/Shanghai

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build:server \
 && npm run build:client \
 && npm prune --omit=dev

RUN mkdir -p /app/data \
 && chown -R node:node /app

USER node
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.SERVER_PORT||3002)+'/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/server/main.js"]
