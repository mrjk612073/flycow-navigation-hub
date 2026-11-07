import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard, OptionalAuthGuard, AdminGuard, type AuthRequest } from './auth.guard';
import {
  LoginDto,
  RegisterDto,
  UpdateUserDto,
} from './dto';
import type {
  AuthResponse,
  NavUser,
} from '@shared/api.interface';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(
      dto.username,
      dto.password,
      dto.displayName,
    );
  }

  @Post('login')
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto.username, dto.password);
  }

  @UseGuards(OptionalAuthGuard)
  @Get('me')
  async getMe(@Req() req: AuthRequest): Promise<{ user: NavUser | null }> {
    if (!req.user) {
      return { user: null };
    }
    const user = await this.authService.findById(req.user.userId);
    return { user };
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Get('users')
  async getUsers(): Promise<{ users: NavUser[] }> {
    const users = await this.authService.findAll();
    return { users };
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<{ user: NavUser }> {
    const user = await this.authService.updateUser(id, {
      displayName: dto.displayName,
      role: dto.role,
      isActive: dto.isActive,
      password: dto.password,
    });
    return { user };
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Delete('users/:id')
  async deleteUser(@Param('id') id: string): Promise<{ success: true }> {
    await this.authService.deleteUser(id);
    return { success: true };
  }
}
