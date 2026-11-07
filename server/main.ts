import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { __express as hbsExpressEngine } from 'hbs';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  // bodyParser 关闭，下面用更大的 limit 重新注册，避免壁纸等大 JSON 被默认 100kb 限制拦掉
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: process.env.NODE_ENV !== 'development',
    bodyParser: false,
  });

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  app.set('trust proxy', true);

  const logger = new Logger('Bootstrap');
  const host = process.env.SERVER_HOST || 'localhost';
  const port = Number(process.env.SERVER_PORT || '3000');

  // vite 产物的入口 html 有时会落在 dist/client/client/index.html（模板预设的已知行为），
  // 这里按实际存在的位置探测，避免 "/" 渲染报 Failed to lookup view "index"
  const clientRoot = join(process.cwd(), 'dist/client');
  const viewsDir = existsSync(join(clientRoot, 'index.html'))
    ? clientRoot
    : join(clientRoot, 'client');
  logger.log(`client views dir: ${viewsDir}`);

  // 注册视图引擎, 渲染 client 目录下的 html 文件
  app.setBaseViewsDir(viewsDir);
  app.setViewEngine('html');
  app.engine('html', hbsExpressEngine);
  // 前端静态资源（JS/CSS/图片）；assets 在 dist/client/assets
  app.useStaticAssets(clientRoot);

  await app.listen(port, host);
  logger.log(`Server running on ${host}:${port}`);
  logger.log(`API endpoints ready at http://${host}:${port}/api`);
}

bootstrap();
