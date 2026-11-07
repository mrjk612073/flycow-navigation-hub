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
import { NavService } from './nav.service';
import { SettingsService } from '../settings/settings.service';
import { AuthGuard, type AuthRequest } from '../auth/auth.guard';
import {
  CreateCardDto,
  CreateGroupDto,
  ReorderCardsDto,
  UpdateCardDto,
  UpdateGroupDto,
} from './dto';

@Controller('api/nav')
export class NavController {
  constructor(
    private readonly navService: NavService,
    private readonly settingsService: SettingsService,
  ) {}

  private ensureEditor(xEditToken: string | undefined): void {
    const valid = this.settingsService.validateEditToken(xEditToken);
    if (!valid) {
      throw new ForbiddenException('无效的编辑令牌');
    }
  }

  // ============ 公共读接口 ============

  @Get('groups')
  async getGroups() {
    return this.navService.getGroups('public');
  }

  @Get('all')
  async getAll() {
    return this.navService.getAll('public');
  }

  // ============ 公共写接口（编辑令牌保护） ============

  @Post('groups')
  async createGroup(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Body() dto: CreateGroupDto,
  ) {
    this.ensureEditor(xEditToken);
    return this.navService.createGroup(dto, 'public');
  }

  @Patch('groups/:id')
  async updateGroup(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    this.ensureEditor(xEditToken);
    return this.navService.updateGroup(id, dto, 'public');
  }

  @Delete('groups/:id')
  async deleteGroup(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Param('id') id: string,
  ) {
    this.ensureEditor(xEditToken);
    return this.navService.deleteGroup(id, 'public');
  }

  @Post('cards')
  async createCard(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Body() dto: CreateCardDto,
  ) {
    this.ensureEditor(xEditToken);
    return this.navService.createCard(dto, 'public');
  }

  @Patch('cards/:id')
  async updateCard(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateCardDto,
  ) {
    this.ensureEditor(xEditToken);
    return this.navService.updateCard(id, dto, 'public');
  }

  @Delete('cards/:id')
  async deleteCard(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Param('id') id: string,
  ) {
    this.ensureEditor(xEditToken);
    return this.navService.deleteCard(id, 'public');
  }

  @Post('cards/reorder')
  async reorderCards(
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Body() dto: ReorderCardsDto,
  ) {
    this.ensureEditor(xEditToken);
    return this.navService.reorderCards(dto, 'public');
  }

  // ============ 用户专属接口（登录态） ============

  @UseGuards(AuthGuard)
  @Get('user/all')
  async getUserAll(@Req() req: AuthRequest) {
    return this.navService.getAll(req.user.userId, false);
  }

  @UseGuards(AuthGuard)
  @Get('user/groups')
  async getUserGroups(@Req() req: AuthRequest) {
    return this.navService.getGroups(req.user.userId, false);
  }

  @UseGuards(AuthGuard)
  @Post('user/groups')
  async createUserGroup(
    @Req() req: AuthRequest,
    @Body() dto: CreateGroupDto,
  ) {
    return this.navService.createGroup(dto, req.user.userId);
  }

  @UseGuards(AuthGuard)
  @Patch('user/groups/:id')
  async updateUserGroup(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.navService.updateGroup(id, dto, req.user.userId);
  }

  @UseGuards(AuthGuard)
  @Delete('user/groups/:id')
  async deleteUserGroup(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.navService.deleteGroup(id, req.user.userId);
  }

  @UseGuards(AuthGuard)
  @Post('user/cards')
  async createUserCard(
    @Req() req: AuthRequest,
    @Body() dto: CreateCardDto,
  ) {
    return this.navService.createCard(dto, req.user.userId);
  }

  @UseGuards(AuthGuard)
  @Patch('user/cards/:id')
  async updateUserCard(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCardDto,
  ) {
    return this.navService.updateCard(id, dto, req.user.userId);
  }

  @UseGuards(AuthGuard)
  @Delete('user/cards/:id')
  async deleteUserCard(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.navService.deleteCard(id, req.user.userId);
  }

  @UseGuards(AuthGuard)
  @Post('user/cards/reorder')
  async reorderUserCards(
    @Req() req: AuthRequest,
    @Body() dto: ReorderCardsDto,
  ) {
    return this.navService.reorderCards(dto, req.user.userId);
  }
}
