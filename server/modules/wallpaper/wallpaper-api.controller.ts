import { Controller, Get } from '@nestjs/common';
import { WallpaperService } from './wallpaper.service';
import type { ApiRandomResponse } from '@shared/api.interface';

@Controller('api/wallpaper')
export class WallpaperApiController {
  constructor(private readonly wallpaperService: WallpaperService) {}

  @Get('api-random')
  async getApiRandom(): Promise<ApiRandomResponse> {
    return this.wallpaperService.getApiRandomWallpaper();
  }
}
