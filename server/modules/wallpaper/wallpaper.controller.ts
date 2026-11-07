import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WallpaperService } from './wallpaper.service';
import { SettingsService } from '../settings/settings.service';
import { AuthGuard, type AuthRequest } from '../auth/auth.guard';
import { CreateWallpaperDto, UpdateWallpaperDto } from './dto';
import type { Wallpaper } from '@shared/api.interface';

@Controller('api/wallpapers')
export class WallpaperController {
  constructor(
    private readonly wallpaperService: WallpaperService,
    private readonly settingsService: SettingsService,
  ) {}

  private ensureEditor(xEditToken: string | undefined): void {
    const valid = this.settingsService.validateEditToken(xEditToken);
    if (!valid) {
      throw new ForbiddenException('无效的编辑令牌');
    }
  }

  // ============ 公共读接口 ============

  @Get()
  async findAll(): Promise<Wallpaper[]> {
    return this.wallpaperService.findAll();
  }

  // ============ 公共写接口 ============

  @Post()
  async create(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Body() dto: CreateWallpaperDto,
  ): Promise<Wallpaper> {
    this.ensureEditor(xEditToken);
    return this.wallpaperService.create(dto, 'public');
  }

  @Patch(':id')
  async update(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateWallpaperDto,
  ): Promise<Wallpaper> {
    this.ensureEditor(xEditToken);
    return this.wallpaperService.update(id, dto, 'public');
  }

  @Delete(':id')
  async remove(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Param('id') id: string,
  ): Promise<void> {
    this.ensureEditor(xEditToken);
    return this.wallpaperService.remove(id, 'public');
  }

  // ============ 用户专属接口 ============

  @UseGuards(AuthGuard)
  @Get('user/list')
  async findUserAll(@Req() req: AuthRequest): Promise<Wallpaper[]> {
    return this.wallpaperService.findAll(req.user.userId);
  }

  @UseGuards(AuthGuard)
  @Post('user')
  async createUser(
    @Req() req: AuthRequest,
    @Body() dto: CreateWallpaperDto,
  ): Promise<Wallpaper> {
    return this.wallpaperService.create(dto, req.user.userId);
  }

  @UseGuards(AuthGuard)
  @Patch('user/:id')
  async updateUser(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateWallpaperDto,
  ): Promise<Wallpaper> {
    return this.wallpaperService.update(id, dto, req.user.userId);
  }

  @UseGuards(AuthGuard)
  @Delete('user/:id')
  async removeUser(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ): Promise<void> {
    return this.wallpaperService.remove(id, req.user.userId);
  }
}
