import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, count } from 'drizzle-orm';
import { createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { navUsers } from '@server/database/sqlite-schema';
import { SQLITE_DATABASE } from '@server/database/database.service';
import type {
  AuthResponse,
  NavUser,
} from '@shared/api.interface';

const JWT_SECRET = 'compass-nav-user-secret-key-2024';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const PBKDF2_ITERATIONS = 10000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha256';

function hashPassword(password: string, salt?: string): string {
  const saltHex = salt ?? randomBytes(16).toString('hex');
  const derived = pbkdf2Sync(
    password,
    saltHex,
    PBKDF2_ITERATIONS,
    PBKDF2_KEYLEN,
    PBKDF2_DIGEST,
  ).toString('hex');
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${saltHex}$${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const [, iterationsStr, salt] = parts;
    const iterations = Number(iterationsStr);
    const rehashed = hashPassword(password, salt);
    const rehashParts = rehashed.split('$');
    const a = Buffer.from(rehashParts[3] ?? '', 'hex');
    const b = Buffer.from(parts[3] ?? '', 'hex');
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) {
      diff |= a[i] ^ b[i];
    }
    return diff === 0 && iterations === PBKDF2_ITERATIONS;
  } catch {
    return false;
  }
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(data: string): string {
  const padded = data + '='.repeat((4 - (data.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf-8');
}

export function signUserToken(userId: string, username: string, role: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    username,
    role,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${headerB64}.${payloadB64}.${signature}`;
}

export function verifyUserToken(token: string): {
  sub: string;
  username: string;
  role: string;
} | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signature] = parts;
    const expectedSig = createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    if (expectedSig !== signature) return null;
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as {
      sub: string;
      username: string;
      role: string;
      exp: number;
    };
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return {
      sub: payload.sub,
      username: payload.username,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(SQLITE_DATABASE)
    private readonly db: BetterSQLite3Database<
      typeof import('@server/database/sqlite-schema')
    >,
  ) {}

  private toNavUser(row: typeof navUsers.$inferSelect): NavUser {
    return {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      role: row.role as 'admin' | 'user',
    };
  }

  async register(
    username: string,
    password: string,
    displayName?: string,
  ): Promise<AuthResponse> {
    // Check username uniqueness
    const existing = await this.db
      .select({ id: navUsers.id })
      .from(navUsers)
      .where(eq(navUsers.username, username))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('用户名已存在');
    }

    // Determine role: first user is admin
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(navUsers);
    const role: 'admin' | 'user' = total === 0 ? 'admin' : 'user';

    const passwordHash = hashPassword(password);
    const id = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

    const [created] = await this.db
      .insert(navUsers)
      .values({
        id,
        username,
        passwordHash,
        displayName: displayName ?? username,
        role,
        isActive: true,
      })
      .returning();

    const user = this.toNavUser(created);
    const token = signUserToken(user.id, user.username, user.role);
    return { user, token };
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    const rows = await this.db
      .select()
      .from(navUsers)
      .where(eq(navUsers.username, username))
      .limit(1);

    if (rows.length === 0) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const row = rows[0];

    if (!row.isActive) {
      throw new UnauthorizedException('账户已被禁用');
    }

    const valid = verifyPassword(password, row.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const user = this.toNavUser(row);
    const token = signUserToken(user.id, user.username, user.role);
    return { user, token };
  }

  async findById(userId: string): Promise<NavUser> {
    const rows = await this.db
      .select()
      .from(navUsers)
      .where(eq(navUsers.id, userId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    return this.toNavUser(rows[0]);
  }

  async findAll(): Promise<NavUser[]> {
    const rows = await this.db.select().from(navUsers).orderBy(navUsers.createdAt);
    return rows.map((r) => this.toNavUser(r));
  }

  async updateUser(
    id: string,
    patch: {
      displayName?: string;
      role?: 'admin' | 'user';
      isActive?: boolean;
      password?: string;
    },
  ): Promise<NavUser> {
    const updateData: Partial<typeof navUsers.$inferInsert> = {};

    if (patch.displayName !== undefined) {
      updateData.displayName = patch.displayName;
    }
    if (patch.role !== undefined) {
      updateData.role = patch.role;
    }
    if (patch.isActive !== undefined) {
      updateData.isActive = patch.isActive;
    }
    if (patch.password !== undefined) {
      updateData.passwordHash = hashPassword(patch.password);
    }

    if (Object.keys(updateData).length === 0) {
      const rows = await this.db
        .select()
        .from(navUsers)
        .where(eq(navUsers.id, id))
        .limit(1);
      if (rows.length === 0) throw new NotFoundException('用户不存在');
      return this.toNavUser(rows[0]);
    }

    const updated = await this.db
      .update(navUsers)
      .set(updateData)
      .where(eq(navUsers.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    return this.toNavUser(updated[0]);
  }

  async deleteUser(id: string): Promise<void> {
    const deleted = await this.db
      .delete(navUsers)
      .where(eq(navUsers.id, id))
      .returning({ id: navUsers.id });

    if (deleted.length === 0) {
      throw new NotFoundException('用户不存在');
    }
  }
}
