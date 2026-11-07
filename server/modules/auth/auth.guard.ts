import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { verifyUserToken } from './auth.service';

export interface AuthUser {
  userId: string;
  username: string;
  role: string;
}

export interface AuthRequest extends Request {
  user: AuthUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const authHeader = req.headers['x-app-auth'] ?? req.headers.authorization;
    const tokenStr = typeof authHeader === 'string' ? authHeader : '';

    if (!tokenStr) {
      throw new UnauthorizedException('未提供认证令牌');
    }

    const token = tokenStr.startsWith('Bearer ') ? tokenStr.slice(7) : tokenStr;
    const payload = verifyUserToken(token);

    if (!payload) {
      throw new UnauthorizedException('令牌无效或已过期');
    }

    req.user = {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
    };

    return true;
  }
}

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const authHeader = req.headers['x-app-auth'] ?? req.headers.authorization;
    const tokenStr = typeof authHeader === 'string' ? authHeader : '';

    if (!tokenStr) {
      return true;
    }

    const token = tokenStr.startsWith('Bearer ') ? tokenStr.slice(7) : tokenStr;
    const payload = verifyUserToken(token);

    if (!payload) {
      return true;
    }

    req.user = {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
    };

    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (!req.user || req.user.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }
    return true;
  }
}
