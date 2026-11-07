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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WidgetService } from './widget.service';
import { SettingsService } from '../settings/settings.service';
import { AuthGuard, type AuthRequest } from '../auth/auth.guard';
import {
  CreateWidgetDto,
  UpdateWidgetDto,
  BatchUpdateLayoutDto,
  ResetLayoutDto,
} from './dto';
import type { Widget, WidgetLayout } from '@shared/api.interface';

@Controller('api/widgets')
export class WidgetController {
  constructor(
    private readonly widgetService: WidgetService,
    private readonly settingsService: SettingsService,
  ) {}

  private ensureEditor(xEditToken: string | undefined): void {
    const valid = this.settingsService.validateEditToken(xEditToken);
    if (!valid) {
      throw new ForbiddenException('无效的编辑令牌');
    }
  }

  // ============ 公共读接口 ============

  @Get('public')
  async getPublicLayout(
    @Query('gridCols') gridCols?: string,
  ): Promise<WidgetLayout> {
    const cols = gridCols ? Number(gridCols) : 6;
    return this.widgetService.getPublicLayout(cols);
  }

  // ============ 公共写接口（编辑密码模式） ============

  @Post()
  async createPublic(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Body() dto: CreateWidgetDto,
  ): Promise<Widget> {
    this.ensureEditor(xEditToken);
    return this.widgetService.create(dto, 'public');
  }

  @Patch(':id')
  async updatePublic(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateWidgetDto,
  ): Promise<Widget> {
    this.ensureEditor(xEditToken);
    return this.widgetService.update(id, dto, 'public');
  }

  @Delete(':id')
  async removePublic(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Param('id') id: string,
  ): Promise<void> {
    this.ensureEditor(xEditToken);
    return this.widgetService.remove(id, 'public');
  }

  @Post('batch-update')
  async batchUpdatePublic(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Body() dto: BatchUpdateLayoutDto,
  ): Promise<{ updated: number }> {
    this.ensureEditor(xEditToken);
    return this.widgetService.batchUpdateLayout(dto, 'public');
  }

  @Post('reset')
  async resetPublic(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Body() dto: ResetLayoutDto,
  ): Promise<WidgetLayout> {
    this.ensureEditor(xEditToken);
    return this.widgetService.resetLayout('public', dto.template ?? 'default');
  }

  @Post('template/:name')
  async applyTemplatePublic(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Param('name') name: string,
  ): Promise<WidgetLayout> {
    this.ensureEditor(xEditToken);
    return this.widgetService.applyTemplate('public', name);
  }

  // ============ 用户专属接口（JWT 登录态） ============

  @UseGuards(AuthGuard)
  @Get('user')
  async getUserLayout(
    @Req() req: AuthRequest,
    @Query('gridCols') gridCols?: string,
  ): Promise<WidgetLayout> {
    const cols = gridCols ? Number(gridCols) : 6;
    return this.widgetService.getUserLayout(req.user.userId, cols);
  }

  @UseGuards(AuthGuard)
  @Post('user')
  async createUser(
    @Req() req: AuthRequest,
    @Body() dto: CreateWidgetDto,
  ): Promise<Widget> {
    return this.widgetService.create(dto, req.user.userId);
  }

  @UseGuards(AuthGuard)
  @Patch('user/:id')
  async updateUser(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateWidgetDto,
  ): Promise<Widget> {
    return this.widgetService.update(id, dto, req.user.userId);
  }

  @UseGuards(AuthGuard)
  @Delete('user/:id')
  async removeUser(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ): Promise<void> {
    return this.widgetService.remove(id, req.user.userId);
  }

  @UseGuards(AuthGuard)
  @Post('user/batch-update')
  async batchUpdateUser(
    @Req() req: AuthRequest,
    @Body() dto: BatchUpdateLayoutDto,
  ): Promise<{ updated: number }> {
    return this.widgetService.batchUpdateLayout(dto, req.user.userId);
  }

  @UseGuards(AuthGuard)
  @Post('user/reset')
  async resetUser(
    @Req() req: AuthRequest,
    @Body() dto: ResetLayoutDto,
  ): Promise<WidgetLayout> {
    return this.widgetService.resetLayout(req.user.userId, dto.template ?? 'default');
  }

  @UseGuards(AuthGuard)
  @Post('user/template/:name')
  async applyTemplateUser(
    @Req() req: AuthRequest,
    @Param('name') name: string,
  ): Promise<WidgetLayout> {
    return this.widgetService.applyTemplate(req.user.userId, name);
  }
}
