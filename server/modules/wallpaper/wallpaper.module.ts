import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WallpaperController } from './wallpaper.controller';
import { WallpaperApiController } from './wallpaper-api.controller';
import { WallpaperService } from './wallpaper.service';
import { SettingsModule } from '../settings/settings.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '@server/database/database.module';

@Module({
  imports: [DatabaseModule, SettingsModule, AuthModule, HttpModule],
  controllers: [WallpaperController, WallpaperApiController],
  providers: [WallpaperService],
})
export class WallpaperModule {}
