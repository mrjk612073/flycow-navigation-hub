import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { and, eq, or } from 'drizzle-orm';
import { appSettings, wallpapers } from '@server/database/sqlite-schema';
import { SQLITE_DATABASE } from '@server/database/database.service';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { firstValueFrom } from 'rxjs';
import type {
  ApiRandomResponse,
  Wallpaper,
  CreateWallpaperRequest,
  UpdateWallpaperRequest,
} from '@shared/api.interface';

function genId(): string {
  return `wp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

@Injectable()
export class WallpaperService {
  private readonly logger = new Logger(WallpaperService.name);

  constructor(
    @Inject(SQLITE_DATABASE)
    private readonly db: BetterSQLite3Database<
      typeof import('@server/database/sqlite-schema')
    >,
    private readonly httpService: HttpService,
  ) {}

  async findAll(userId?: string): Promise<Wallpaper[]> {
    const query = this.db
      .select({
        id: wallpapers.id,
        name: wallpapers.name,
        filePath: wallpapers.filePath,
        downloadUrl: wallpapers.downloadUrl,
        sortOrder: wallpapers.sortOrder,
        isDefault: wallpapers.isDefault,
      })
      .from(wallpapers)
      .orderBy(wallpapers.sortOrder);

    if (userId) {
      query.where(or(eq(wallpapers.userId, userId), eq(wallpapers.isPublic, true)));
    } else {
      query.where(eq(wallpapers.isPublic, true));
    }

    const results = query.all();
    return results as Wallpaper[];
  }

  async create(dto: CreateWallpaperRequest, userId?: string): Promise<Wallpaper> {
    const [created] = this.db
      .insert(wallpapers)
      .values({
        id: genId(),
        name: dto.name,
        filePath: dto.filePath ?? null,
        downloadUrl: dto.downloadUrl ?? null,
        sortOrder: dto.sortOrder ?? 0,
        userId: userId ?? 'public',
        isPublic: userId ? false : true,
      })
      .returning({
        id: wallpapers.id,
        name: wallpapers.name,
        filePath: wallpapers.filePath,
        downloadUrl: wallpapers.downloadUrl,
        sortOrder: wallpapers.sortOrder,
        isDefault: wallpapers.isDefault,
      })
      .all();

    return created as Wallpaper;
  }

  async update(
    id: string,
    dto: UpdateWallpaperRequest,
    userId?: string,
  ): Promise<Wallpaper> {
    const patch: Partial<typeof wallpapers.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    if (dto.isDefault !== undefined) patch.isDefault = dto.isDefault;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const conditions = [eq(wallpapers.id, id)];
    if (userId) {
      conditions.push(eq(wallpapers.userId, userId));
    }

    const updated = this.db
      .update(wallpapers)
      .set(patch)
      .where(and(...conditions))
      .returning({
        id: wallpapers.id,
        name: wallpapers.name,
        filePath: wallpapers.filePath,
        downloadUrl: wallpapers.downloadUrl,
        sortOrder: wallpapers.sortOrder,
        isDefault: wallpapers.isDefault,
      })
      .all();

    if (updated.length === 0) {
      throw new NotFoundException('壁纸不存在');
    }

    return updated[0] as Wallpaper;
  }

  async remove(id: string, userId?: string): Promise<void> {
    const conditions = [eq(wallpapers.id, id)];
    if (userId) {
      conditions.push(eq(wallpapers.userId, userId));
    }

    const deleted = this.db
      .delete(wallpapers)
      .where(and(...conditions))
      .returning({ id: wallpapers.id })
      .all();

    if (deleted.length === 0) {
      throw new NotFoundException('壁纸不存在');
    }
  }

  // ============ API Random Proxy ============

  async getApiRandomWallpaper(): Promise<ApiRandomResponse> {
    const settingsRows = this.db
      .select({
        wallpaperApiEnabled: appSettings.wallpaperApiEnabled,
        wallpaperApiUrl: appSettings.wallpaperApiUrl,
      })
      .from(appSettings)
      .limit(1)
      .all();

    const settings = settingsRows[0];
    if (!settings || !settings.wallpaperApiEnabled || !settings.wallpaperApiUrl) {
      return { fallback: true };
    }

    const apiUrl = settings.wallpaperApiUrl;

    try {
      const response = await firstValueFrom(
        this.httpService.get(apiUrl, {
          timeout: 5000,
          responseType: 'arraybuffer',
        }),
      );

      const contentType = response.headers['content-type'] as string | undefined;

      if (contentType?.startsWith('image/')) {
        const base64 = Buffer.from(response.data as ArrayBuffer).toString('base64');
        return {
          fallback: false,
          imageData: `data:${contentType};base64,${base64}`,
          source: 'api',
        };
      }

      // Try to parse as JSON and extract image URL
      if (contentType?.includes('application/json') || contentType?.includes('text/')) {
        const text = Buffer.from(response.data as ArrayBuffer).toString('utf-8');
        const imageUrl = this.extractImageUrl(text, apiUrl);
        if (imageUrl) {
          return await this.fetchImageAsBase64(imageUrl);
        }
      }

      return { fallback: true };
    } catch (error) {
      this.logger.warn(
        `壁纸 API 请求失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { fallback: true };
    }
  }

  private extractImageUrl(text: string, apiUrl: string): string | null {
    try {
      const data = JSON.parse(text);

      // Direct url property (string)
      if (typeof data.url === 'string' && data.url) {
        return this.resolveUrl(data.url, apiUrl);
      }

      // bing-style: images[0].url
      if (Array.isArray(data.images) && data.images.length > 0) {
        const first = data.images[0];
        if (typeof first.url === 'string' && first.url) {
          return this.resolveUrl(first.url, apiUrl);
        }
        // bing urlbase + /th?id=...
        if (typeof first.urlbase === 'string' && first.urlbase) {
          return this.resolveUrl(`${first.urlbase}_1920x1080.jpg`, apiUrl);
        }
      }

      // data.url wrapper
      if (data.data && typeof data.data.url === 'string' && data.data.url) {
        return this.resolveUrl(data.data.url, apiUrl);
      }

      // data.images[0].url (nested)
      if (
        data.data &&
        Array.isArray(data.data.images) &&
        data.data.images.length > 0
      ) {
        const first = data.data.images[0];
        if (typeof first.url === 'string' && first.url) {
          return this.resolveUrl(first.url, apiUrl);
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private resolveUrl(url: string, baseUrl: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    try {
      const base = new URL(baseUrl);
      return new URL(url, base).toString();
    } catch {
      return url;
    }
  }

  private async fetchImageAsBase64(url: string): Promise<ApiRandomResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          timeout: 5000,
          responseType: 'arraybuffer',
        }),
      );

      const contentType = response.headers['content-type'] as string | undefined;
      if (!contentType?.startsWith('image/')) {
        return { fallback: true };
      }

      const base64 = Buffer.from(response.data as ArrayBuffer).toString('base64');
      return {
        fallback: false,
        imageData: `data:${contentType};base64,${base64}`,
        source: 'api',
      };
    } catch (error) {
      this.logger.warn(
        `壁纸图片下载失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { fallback: true };
    }
  }
}
