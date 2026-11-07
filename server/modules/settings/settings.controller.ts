import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import * as fs from 'node:fs';
import { SettingsService } from './settings.service';
import { AuthGuard, type AuthRequest } from '../auth/auth.guard';
import {
  ChangePasswordDto,
  ImportDataDto,
  UpdateSettingsDto,
  VerifyPasswordDto,
} from './dto';
import type {
  AppSettings,
  ExportDataResponse,
  ImportDataResponse,
  PublicSettingsResponse,
  VerifyPasswordResponse,
} from '@shared/api.interface';
import { DatabaseService } from '@server/database/database.service';

@Controller('api/settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get('public')
  async getPublicSettings(): Promise<PublicSettingsResponse> {
    return this.settingsService.getPublicSettings();
  }

  @Post('verify-password')
  async verifyPassword(
    @Body() dto: VerifyPasswordDto,
  ): Promise<VerifyPasswordResponse> {
    return this.settingsService.verifyPassword(dto.password);
  }

  private ensureEditor(xEditToken: string | undefined): void {
    const valid = this.settingsService.validateEditToken(xEditToken);
    if (!valid) {
      throw new ForbiddenException('无效的编辑令牌');
    }
  }

  // ============ 公共设置写接口 ============

  @Patch()
  async updateSettings(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Body() dto: UpdateSettingsDto,
  ): Promise<{ settings: AppSettings }> {
    this.ensureEditor(xEditToken);
    const settings = await this.settingsService.updateSettings({
      wallpaperInterval: dto.wallpaperInterval,
      wallpaperEnabled: dto.wallpaperEnabled,
      searchEngine: dto.searchEngine,
      clock24h: dto.clock24h,
      showSeconds: dto.showSeconds,
      wallpaperApiEnabled: dto.wallpaperApiEnabled,
      wallpaperApiUrl: dto.wallpaperApiUrl,
      wallpaperApiRefreshOnLoad: dto.wallpaperApiRefreshOnLoad,
      natEnabled: dto.natEnabled,
      natIntranetPrefix: dto.natIntranetPrefix,
      natExtranetPrefix: dto.natExtranetPrefix,
      weatherEnabled: dto.weatherEnabled,
      weatherLocation: dto.weatherLocation,
      weatherUnit: dto.weatherUnit,
      weatherRefreshInterval: dto.weatherRefreshInterval,
      weatherProvider: dto.weatherProvider,
      weatherApiKey: dto.weatherApiKey,
      weatherApiHost: dto.weatherApiHost,
      weatherCustomUrl: dto.weatherCustomUrl,
      weatherCustomMapping: dto.weatherCustomMapping,
      weatherAdcode: dto.weatherAdcode,
      weatherLocationName: dto.weatherLocationName,
    });
    return { settings };
  }

  @Post('change-password')
  async changePassword(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ success: true }> {
    this.ensureEditor(xEditToken);
    await this.settingsService.changePassword(dto.oldPassword, dto.newPassword);
    return { success: true };
  }

  @Get('export')
  async exportData(
    @Headers('x-edit-token') xEditToken: string | undefined,
  ): Promise<ExportDataResponse> {
    this.ensureEditor(xEditToken);
    return this.settingsService.exportData();
  }

  @Post('import')
  async importData(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Body() dto: ImportDataDto,
  ): Promise<ImportDataResponse> {
    this.ensureEditor(xEditToken);
    if (!dto.data) {
      throw new BadRequestException('缺少导入数据');
    }
    const payload = dto.data as unknown as ExportDataResponse['data'];
    return this.settingsService.importData(dto.mode, payload);
  }

  // ============ 用户设置接口 ============

  @UseGuards(AuthGuard)
  @Get('user')
  async getUserSettings(@Req() req: AuthRequest): Promise<PublicSettingsResponse> {
    return this.settingsService.getPublicSettings(req.user.userId);
  }

  @UseGuards(AuthGuard)
  @Patch('user')
  async updateUserSettings(
    @Req() req: AuthRequest,
    @Body() dto: UpdateSettingsDto,
  ): Promise<{ settings: AppSettings }> {
    const settings = await this.settingsService.updateSettings({
      wallpaperInterval: dto.wallpaperInterval,
      wallpaperEnabled: dto.wallpaperEnabled,
      searchEngine: dto.searchEngine,
      clock24h: dto.clock24h,
      showSeconds: dto.showSeconds,
      wallpaperApiEnabled: dto.wallpaperApiEnabled,
      wallpaperApiUrl: dto.wallpaperApiUrl,
      wallpaperApiRefreshOnLoad: dto.wallpaperApiRefreshOnLoad,
      natEnabled: dto.natEnabled,
      natIntranetPrefix: dto.natIntranetPrefix,
      natExtranetPrefix: dto.natExtranetPrefix,
      weatherEnabled: dto.weatherEnabled,
      weatherLocation: dto.weatherLocation,
      weatherUnit: dto.weatherUnit,
      weatherRefreshInterval: dto.weatherRefreshInterval,
      weatherProvider: dto.weatherProvider,
      weatherApiKey: dto.weatherApiKey,
      weatherApiHost: dto.weatherApiHost,
      weatherCustomUrl: dto.weatherCustomUrl,
      weatherCustomMapping: dto.weatherCustomMapping,
      weatherAdcode: dto.weatherAdcode,
      weatherLocationName: dto.weatherLocationName,
    }, req.user.userId);
    return { settings };
  }

  @UseGuards(AuthGuard)
  @Get('user/export')
  async exportUserData(@Req() req: AuthRequest): Promise<ExportDataResponse> {
    return this.settingsService.exportData(req.user.userId);
  }

  @UseGuards(AuthGuard)
  @Post('user/import')
  async importUserData(
    @Req() req: AuthRequest,
    @Body() dto: ImportDataDto,
  ): Promise<ImportDataResponse> {
    if (!dto.data) {
      throw new BadRequestException('缺少导入数据');
    }
    const payload = dto.data as unknown as ExportDataResponse['data'];
    return this.settingsService.importData(dto.mode, payload, req.user.userId);
  }

  // ============ 存储信息 ============

  @Get('storage-info')
  getStorageInfo(): { dataDir: string; dbPath: string; dbSize: number } {
    const dbPath = this.databaseService.getDbPath();
    const dataDir = this.databaseService.getDataDir();
    let dbSize = 0;
    try {
      const stat = fs.statSync(dbPath);
      dbSize = stat.size;
    } catch {
      // ignore
    }
    return { dataDir, dbPath, dbSize };
  }
}
