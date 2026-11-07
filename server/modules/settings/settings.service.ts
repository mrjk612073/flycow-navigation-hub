import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SQLITE_DATABASE } from '@server/database/database.service';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import type {
  AppSettings,
  ExportDataResponse,
  ImportDataResponse,
  NavCard,
  NavGroup,
  PublicSettingsResponse,
  Wallpaper,
} from '@shared/api.interface';
import {
  appSettings,
  wallpapers,
  navCards,
  navGroups,
  userSettings,
} from '@server/database/sqlite-schema';

const JWT_SECRET = 'compass-nav-secret-key-2024';
const TOKEN_TTL_SECONDS = 24 * 60 * 60;
const PBKDF2_ITERATIONS = 10000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha256';
const DEFAULT_PASSWORD = 'admin123';

const DEFAULT_SETTINGS: AppSettings = {
  wallpaperInterval: 300,
  wallpaperEnabled: true,
  searchEngine: 'baidu',
  clock24h: true,
  showSeconds: true,
  wallpaperApiEnabled: false,
  wallpaperApiUrl: '',
  wallpaperApiRefreshOnLoad: false,
  natEnabled: false,
  natIntranetPrefix: '',
  natExtranetPrefix: '',
  weatherEnabled: true,
  weatherLocation: '',
  weatherUnit: 'c',
  weatherRefreshInterval: 30,
  weatherProvider: 'wttr',
  weatherApiKey: '',
  weatherApiHost: '',
  weatherCustomUrl: '',
  weatherCustomMapping: '',
  weatherAdcode: '',
  weatherLocationName: '',
  weatherFallbackMessage: '',
};

function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

function isMaskedApiKey(key: string): boolean {
  return key.includes('****');
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

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
    // constant-time-ish comparison
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

function signToken(payload: Record<string, unknown>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${headerB64}.${payloadB64}.${signature}`;
}

function verifyToken(token: string): { role?: string } | null {
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
      exp: number;
      role?: string;
    };
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @Inject(SQLITE_DATABASE)
    private readonly db: BetterSQLite3Database<
      typeof import('@server/database/sqlite-schema')
    >,
  ) {}

  async getPublicSettings(userId?: string): Promise<PublicSettingsResponse> {
    let settings: AppSettings;

    if (userId) {
      const userRow = this.db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .get();

      if (userRow) {
        settings = {
          wallpaperInterval: userRow.wallpaperInterval,
          wallpaperEnabled: userRow.wallpaperEnabled,
          searchEngine: userRow.searchEngine,
          clock24h: userRow.clock24h,
          showSeconds: userRow.showSeconds,
          wallpaperApiEnabled: userRow.wallpaperApiEnabled,
          wallpaperApiUrl: userRow.wallpaperApiUrl,
          wallpaperApiRefreshOnLoad: userRow.wallpaperApiRefreshOnLoad,
          natEnabled: userRow.natEnabled,
          natIntranetPrefix: userRow.natIntranetPrefix,
          natExtranetPrefix: userRow.natExtranetPrefix,
          weatherEnabled: userRow.weatherEnabled,
          weatherLocation: userRow.weatherLocation,
          weatherUnit: userRow.weatherUnit as 'c' | 'f',
          weatherRefreshInterval: userRow.weatherRefreshInterval,
          weatherProvider: userRow.weatherProvider as AppSettings['weatherProvider'],
          weatherApiKey: maskApiKey(userRow.weatherApiKey ?? ''),
          weatherApiHost: userRow.weatherApiHost ?? '',
          weatherCustomUrl: userRow.weatherCustomUrl ?? '',
          weatherCustomMapping: userRow.weatherCustomMapping ?? '',
          weatherAdcode: userRow.weatherAdcode ?? '',
          weatherLocationName: userRow.weatherLocationName ?? '',
          weatherFallbackMessage: '',
        };
      } else {
        // fallback to app_settings public row
        settings = this.getPublicAppSettings();
      }
    } else {
      settings = this.getPublicAppSettings();
    }

    const wallpaperOwnerId = userId ?? 'public';
    const wallpaperRows = this.db
      .select()
      .from(wallpapers)
      .where(eq(wallpapers.userId, wallpaperOwnerId))
      .orderBy(wallpapers.sortOrder)
      .all();

    const wallpaperList: Wallpaper[] = wallpaperRows.map((w) => ({
      id: w.id,
      name: w.name,
      filePath: w.filePath ?? null,
      downloadUrl: w.downloadUrl ?? null,
      sortOrder: w.sortOrder,
      isDefault: w.isDefault,
    }));

    return { settings, wallpapers: wallpaperList };
  }

  // 内部使用：返回天气相关配置，包含明文 API Key（服务端内部调用，不返回给前端）
  getWeatherConfig(userId?: string): {
    weatherProvider: 'wttr' | 'qweather' | 'amap' | 'seniverse' | 'custom';
    weatherApiKey: string;
    weatherApiHost: string;
    weatherCustomUrl: string;
    weatherCustomMapping: string;
    weatherAdcode: string;
    weatherLocation: string;
    weatherLocationName: string;
    weatherUnit: 'c' | 'f';
    weatherEnabled: boolean;
  } {
    let row: { weatherProvider: string; weatherApiKey: string; weatherApiHost: string; weatherCustomUrl: string; weatherCustomMapping: string; weatherAdcode: string; weatherLocation: string; weatherLocationName: string; weatherUnit: string; weatherEnabled: boolean } | undefined;

    if (userId) {
      const userRow = this.db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .get();
      if (userRow) {
        row = {
          weatherProvider: userRow.weatherProvider ?? 'wttr',
          weatherApiKey: userRow.weatherApiKey ?? '',
          weatherApiHost: userRow.weatherApiHost ?? '',
          weatherCustomUrl: userRow.weatherCustomUrl ?? '',
          weatherCustomMapping: userRow.weatherCustomMapping ?? '',
          weatherAdcode: userRow.weatherAdcode ?? '',
          weatherLocation: userRow.weatherLocation ?? '',
          weatherLocationName: userRow.weatherLocationName ?? '',
          weatherUnit: userRow.weatherUnit ?? 'c',
          weatherEnabled: !!userRow.weatherEnabled,
        };
      }
    }

    if (!row) {
      const appRow = this.db
        .select()
        .from(appSettings)
        .where(eq(appSettings.userId, 'public'))
        .get();
      if (appRow) {
        row = {
          weatherProvider: appRow.weatherProvider ?? 'wttr',
          weatherApiKey: appRow.weatherApiKey ?? '',
          weatherApiHost: appRow.weatherApiHost ?? '',
          weatherCustomUrl: appRow.weatherCustomUrl ?? '',
          weatherCustomMapping: appRow.weatherCustomMapping ?? '',
          weatherAdcode: appRow.weatherAdcode ?? '',
          weatherLocation: appRow.weatherLocation ?? '',
          weatherLocationName: appRow.weatherLocationName ?? '',
          weatherUnit: appRow.weatherUnit ?? 'c',
          weatherEnabled: !!appRow.weatherEnabled,
        };
      }
    }

    if (!row) {
      return {
        weatherProvider: 'wttr',
        weatherApiKey: '',
        weatherApiHost: '',
        weatherCustomUrl: '',
        weatherCustomMapping: '',
        weatherAdcode: '',
        weatherLocation: '',
        weatherLocationName: '',
        weatherUnit: 'c',
        weatherEnabled: true,
      };
    }

    return {
      weatherProvider: (row.weatherProvider || 'wttr') as 'wttr' | 'qweather' | 'amap' | 'seniverse' | 'custom',
      weatherApiKey: row.weatherApiKey ?? '',
      weatherApiHost: row.weatherApiHost ?? '',
      weatherCustomUrl: row.weatherCustomUrl ?? '',
      weatherCustomMapping: row.weatherCustomMapping ?? '',
      weatherAdcode: row.weatherAdcode ?? '',
      weatherLocation: row.weatherLocation ?? '',
      weatherLocationName: row.weatherLocationName ?? '',
      weatherUnit: (row.weatherUnit || 'c') as 'c' | 'f',
      weatherEnabled: row.weatherEnabled,
    };
  }

  private getPublicAppSettings(): AppSettings {
    const row = this.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.userId, 'public'))
      .get();

    if (!row) {
      return { ...DEFAULT_SETTINGS };
    }

    return {
      wallpaperInterval: row.wallpaperInterval,
      wallpaperEnabled: row.wallpaperEnabled,
      searchEngine: row.searchEngine,
      clock24h: row.clock24h,
      showSeconds: row.showSeconds,
      wallpaperApiEnabled: row.wallpaperApiEnabled,
      wallpaperApiUrl: row.wallpaperApiUrl,
      wallpaperApiRefreshOnLoad: row.wallpaperApiRefreshOnLoad,
      natEnabled: row.natEnabled,
      natIntranetPrefix: row.natIntranetPrefix,
      natExtranetPrefix: row.natExtranetPrefix,
      weatherEnabled: row.weatherEnabled,
      weatherLocation: row.weatherLocation,
      weatherUnit: row.weatherUnit as 'c' | 'f',
      weatherRefreshInterval: row.weatherRefreshInterval,
      weatherProvider: row.weatherProvider as AppSettings['weatherProvider'],
      weatherApiKey: maskApiKey(row.weatherApiKey ?? ''),
      weatherApiHost: row.weatherApiHost ?? '',
      weatherCustomUrl: row.weatherCustomUrl ?? '',
      weatherCustomMapping: row.weatherCustomMapping ?? '',
      weatherAdcode: row.weatherAdcode ?? '',
      weatherLocationName: row.weatherLocationName ?? '',
      weatherFallbackMessage: '',
    };
  }

  private getAppSettingsRow() {
    const row = this.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.userId, 'public'))
      .get();
    return row ?? null;
  }

  private ensureAppSettingsRow() {
    const existing = this.getAppSettingsRow();
    if (existing) return existing;
    const defaultHash = hashPassword(DEFAULT_PASSWORD);
    const inserted = this.db
      .insert(appSettings)
      .values({
        id: genId('s'),
        userId: 'public',
        editPasswordHash: defaultHash,
        wallpaperInterval: DEFAULT_SETTINGS.wallpaperInterval,
        wallpaperEnabled: DEFAULT_SETTINGS.wallpaperEnabled,
        searchEngine: DEFAULT_SETTINGS.searchEngine,
        clock24h: DEFAULT_SETTINGS.clock24h,
        showSeconds: DEFAULT_SETTINGS.showSeconds,
        wallpaperApiEnabled: DEFAULT_SETTINGS.wallpaperApiEnabled,
        wallpaperApiUrl: DEFAULT_SETTINGS.wallpaperApiUrl,
        wallpaperApiRefreshOnLoad: DEFAULT_SETTINGS.wallpaperApiRefreshOnLoad,
        natEnabled: DEFAULT_SETTINGS.natEnabled,
        natIntranetPrefix: DEFAULT_SETTINGS.natIntranetPrefix,
        natExtranetPrefix: DEFAULT_SETTINGS.natExtranetPrefix,
        weatherEnabled: DEFAULT_SETTINGS.weatherEnabled,
        weatherLocation: DEFAULT_SETTINGS.weatherLocation,
        weatherUnit: DEFAULT_SETTINGS.weatherUnit,
        weatherRefreshInterval: DEFAULT_SETTINGS.weatherRefreshInterval,
        weatherProvider: DEFAULT_SETTINGS.weatherProvider,
        weatherApiKey: DEFAULT_SETTINGS.weatherApiKey,
        weatherApiHost: DEFAULT_SETTINGS.weatherApiHost,
        weatherCustomUrl: DEFAULT_SETTINGS.weatherCustomUrl,
        weatherCustomMapping: DEFAULT_SETTINGS.weatherCustomMapping,
        weatherAdcode: DEFAULT_SETTINGS.weatherAdcode,
        weatherLocationName: DEFAULT_SETTINGS.weatherLocationName,
      })
      .returning()
      .all();
    return inserted[0];
  }

  private ensureUserSettingsRow(userId: string) {
    const existing = this.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .get();

    if (existing) return existing;

    const inserted = this.db
      .insert(userSettings)
      .values({
        id: genId('us'),
        userId,
        wallpaperInterval: DEFAULT_SETTINGS.wallpaperInterval,
        wallpaperEnabled: DEFAULT_SETTINGS.wallpaperEnabled,
        searchEngine: DEFAULT_SETTINGS.searchEngine,
        clock24h: DEFAULT_SETTINGS.clock24h,
        showSeconds: DEFAULT_SETTINGS.showSeconds,
        wallpaperApiEnabled: DEFAULT_SETTINGS.wallpaperApiEnabled,
        wallpaperApiUrl: DEFAULT_SETTINGS.wallpaperApiUrl,
        wallpaperApiRefreshOnLoad: DEFAULT_SETTINGS.wallpaperApiRefreshOnLoad,
        natEnabled: DEFAULT_SETTINGS.natEnabled,
        natIntranetPrefix: DEFAULT_SETTINGS.natIntranetPrefix,
        natExtranetPrefix: DEFAULT_SETTINGS.natExtranetPrefix,
        weatherEnabled: DEFAULT_SETTINGS.weatherEnabled,
        weatherLocation: DEFAULT_SETTINGS.weatherLocation,
        weatherUnit: DEFAULT_SETTINGS.weatherUnit,
        weatherRefreshInterval: DEFAULT_SETTINGS.weatherRefreshInterval,
        weatherProvider: DEFAULT_SETTINGS.weatherProvider,
        weatherApiKey: DEFAULT_SETTINGS.weatherApiKey,
        weatherApiHost: DEFAULT_SETTINGS.weatherApiHost,
        weatherCustomUrl: DEFAULT_SETTINGS.weatherCustomUrl,
        weatherCustomMapping: DEFAULT_SETTINGS.weatherCustomMapping,
        weatherAdcode: DEFAULT_SETTINGS.weatherAdcode,
        weatherLocationName: DEFAULT_SETTINGS.weatherLocationName,
      })
      .returning()
      .all();
    return inserted[0];
  }

  async verifyPassword(
    password: string,
    userId?: string,
  ): Promise<{
    success: boolean;
    token?: string;
  }> {
    // editPassword is global, always on app_settings public row
    const row = this.ensureAppSettingsRow();
    const valid = verifyPassword(password, row.editPasswordHash);
    if (!valid) {
      return { success: false };
    }
    const token = signToken({ role: 'editor' });
    return { success: true, token };
  }

  validateEditToken(token: string | undefined): boolean {
    if (!token) return false;
    const payload = verifyToken(token);
    return !!payload && payload.role === 'editor';
  }

  async updateSettings(
    patch: Partial<{
      wallpaperInterval: number;
      wallpaperEnabled: boolean;
      searchEngine: string;
      clock24h: boolean;
      showSeconds: boolean;
      wallpaperApiEnabled: boolean;
      wallpaperApiUrl: string;
      wallpaperApiRefreshOnLoad: boolean;
      natEnabled: boolean;
      natIntranetPrefix: string;
      natExtranetPrefix: string;
      weatherEnabled: boolean;
      weatherLocation: string;
      weatherUnit: 'c' | 'f';
      weatherRefreshInterval: number;
      weatherProvider: 'wttr' | 'qweather' | 'amap' | 'seniverse' | 'custom';
      weatherApiKey: string;
      weatherApiHost: string;
      weatherCustomUrl: string;
      weatherCustomMapping: string;
      weatherAdcode: string;
      weatherLocationName: string;
    }>,
    userId?: string,
  ): Promise<AppSettings> {
    const updateData: Record<string, unknown> = {};
    if (patch.wallpaperInterval !== undefined) {
      updateData.wallpaperInterval = patch.wallpaperInterval;
    }
    if (patch.wallpaperEnabled !== undefined) {
      updateData.wallpaperEnabled = patch.wallpaperEnabled;
    }
    if (patch.searchEngine !== undefined) {
      updateData.searchEngine = patch.searchEngine;
    }
    if (patch.clock24h !== undefined) {
      updateData.clock24h = patch.clock24h;
    }
    if (patch.showSeconds !== undefined) {
      updateData.showSeconds = patch.showSeconds;
    }
    if (patch.wallpaperApiEnabled !== undefined) {
      updateData.wallpaperApiEnabled = patch.wallpaperApiEnabled;
    }
    if (patch.wallpaperApiUrl !== undefined) {
      updateData.wallpaperApiUrl = patch.wallpaperApiUrl;
    }
    if (patch.wallpaperApiRefreshOnLoad !== undefined) {
      updateData.wallpaperApiRefreshOnLoad = patch.wallpaperApiRefreshOnLoad;
    }
    if (patch.natEnabled !== undefined) {
      updateData.natEnabled = patch.natEnabled;
    }
    if (patch.natIntranetPrefix !== undefined) {
      updateData.natIntranetPrefix = patch.natIntranetPrefix;
    }
    if (patch.natExtranetPrefix !== undefined) {
      updateData.natExtranetPrefix = patch.natExtranetPrefix;
    }
    if (patch.weatherEnabled !== undefined) {
      updateData.weatherEnabled = patch.weatherEnabled;
    }
    if (patch.weatherLocation !== undefined) {
      updateData.weatherLocation = patch.weatherLocation;
    }
    if (patch.weatherUnit !== undefined) {
      updateData.weatherUnit = patch.weatherUnit;
    }
    if (patch.weatherRefreshInterval !== undefined) {
      updateData.weatherRefreshInterval = patch.weatherRefreshInterval;
    }
    if (patch.weatherProvider !== undefined) {
      updateData.weatherProvider = patch.weatherProvider;
    }
    // 只有完整 key（不含 ****）才更新，掩码格式说明用户没改
    if (patch.weatherApiKey !== undefined && !isMaskedApiKey(patch.weatherApiKey)) {
      updateData.weatherApiKey = patch.weatherApiKey;
    }
    if (patch.weatherApiHost !== undefined) {
      updateData.weatherApiHost = patch.weatherApiHost;
    }
    if (patch.weatherCustomUrl !== undefined) {
      updateData.weatherCustomUrl = patch.weatherCustomUrl;
    }
    if (patch.weatherCustomMapping !== undefined) {
      updateData.weatherCustomMapping = patch.weatherCustomMapping;
    }
    if (patch.weatherAdcode !== undefined) {
      updateData.weatherAdcode = patch.weatherAdcode;
    }
    if (patch.weatherLocationName !== undefined) {
      updateData.weatherLocationName = patch.weatherLocationName;
    }
    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    let r: {
      wallpaperInterval: number;
      wallpaperEnabled: boolean;
      searchEngine: string;
      clock24h: boolean;
      showSeconds: boolean;
      wallpaperApiEnabled: boolean;
      wallpaperApiUrl: string;
      wallpaperApiRefreshOnLoad: boolean;
      natEnabled: boolean;
      natIntranetPrefix: string;
      natExtranetPrefix: string;
      weatherEnabled: boolean;
      weatherLocation: string;
      weatherUnit: string;
      weatherRefreshInterval: number;
      weatherProvider: string;
      weatherApiKey: string;
      weatherApiHost: string;
      weatherCustomUrl: string;
      weatherCustomMapping: string;
      weatherAdcode: string;
      weatherLocationName: string;
    };

    if (userId) {
      const row = this.ensureUserSettingsRow(userId);
      const updated = this.db
        .update(userSettings)
        .set(updateData)
        .where(eq(userSettings.id, row.id))
        .returning()
        .all();
      if (updated.length === 0) {
        throw new NotFoundException('用户设置记录不存在');
      }
      r = updated[0];
    } else {
      const row = this.ensureAppSettingsRow();
      const updated = this.db
        .update(appSettings)
        .set(updateData)
        .where(eq(appSettings.id, row.id))
        .returning()
        .all();
      if (updated.length === 0) {
        throw new NotFoundException('设置记录不存在');
      }
      r = updated[0];
    }

    return {
      wallpaperInterval: r.wallpaperInterval,
      wallpaperEnabled: r.wallpaperEnabled,
      searchEngine: r.searchEngine,
      clock24h: r.clock24h,
      showSeconds: r.showSeconds,
      wallpaperApiEnabled: r.wallpaperApiEnabled,
      wallpaperApiUrl: r.wallpaperApiUrl,
      wallpaperApiRefreshOnLoad: r.wallpaperApiRefreshOnLoad,
      natEnabled: r.natEnabled,
      natIntranetPrefix: r.natIntranetPrefix,
      natExtranetPrefix: r.natExtranetPrefix,
      weatherEnabled: r.weatherEnabled,
      weatherLocation: r.weatherLocation,
      weatherUnit: r.weatherUnit as 'c' | 'f',
      weatherRefreshInterval: r.weatherRefreshInterval,
      weatherProvider: r.weatherProvider as AppSettings['weatherProvider'],
      weatherApiKey: maskApiKey(r.weatherApiKey ?? ''),
      weatherApiHost: r.weatherApiHost ?? '',
      weatherCustomUrl: r.weatherCustomUrl ?? '',
      weatherCustomMapping: r.weatherCustomMapping ?? '',
      weatherAdcode: r.weatherAdcode ?? '',
      weatherLocationName: r.weatherLocationName ?? '',
      weatherFallbackMessage: '',
    };
  }

  async changePassword(
    oldPassword: string,
    newPassword: string,
    userId?: string,
  ): Promise<void> {
    // editPassword is global, always on app_settings public row
    const row = this.ensureAppSettingsRow();
    const valid = verifyPassword(oldPassword, row.editPasswordHash);
    if (!valid) {
      throw new ConflictException('旧密码错误');
    }
    const newHash = hashPassword(newPassword);
    this.db
      .update(appSettings)
      .set({ editPasswordHash: newHash })
      .where(eq(appSettings.id, row.id))
      .returning({ id: appSettings.id })
      .all();
  }

  // ============ Export / Import ============

  async exportData(userId?: string): Promise<ExportDataResponse> {
    const ownerId = userId ?? 'public';

    const settingsRow = userId
      ? this.db
          .select()
          .from(userSettings)
          .where(eq(userSettings.userId, userId))
          .get()
      : this.getAppSettingsRow();

    const wallpaperRows = this.db
      .select()
      .from(wallpapers)
      .where(eq(wallpapers.userId, ownerId))
      .orderBy(wallpapers.sortOrder)
      .all();

    const groupRows = this.db
      .select()
      .from(navGroups)
      .where(eq(navGroups.userId, ownerId))
      .orderBy(navGroups.sortOrder)
      .all();

    const cardRows = this.db
      .select()
      .from(navCards)
      .where(eq(navCards.userId, ownerId))
      .orderBy(navCards.sortOrder)
      .all();

    const settings: AppSettings = settingsRow
      ? {
          wallpaperInterval: settingsRow.wallpaperInterval,
          wallpaperEnabled: settingsRow.wallpaperEnabled,
          searchEngine: settingsRow.searchEngine,
          clock24h: settingsRow.clock24h,
          showSeconds: settingsRow.showSeconds,
          wallpaperApiEnabled: settingsRow.wallpaperApiEnabled,
          wallpaperApiUrl: settingsRow.wallpaperApiUrl,
          wallpaperApiRefreshOnLoad: settingsRow.wallpaperApiRefreshOnLoad,
          natEnabled: settingsRow.natEnabled,
          natIntranetPrefix: settingsRow.natIntranetPrefix,
          natExtranetPrefix: settingsRow.natExtranetPrefix,
          weatherEnabled: settingsRow.weatherEnabled,
          weatherLocation: settingsRow.weatherLocation,
          weatherUnit: settingsRow.weatherUnit as 'c' | 'f',
          weatherRefreshInterval: settingsRow.weatherRefreshInterval,
          weatherProvider: (settingsRow.weatherProvider ?? 'wttr') as AppSettings['weatherProvider'],
          weatherApiKey: settingsRow.weatherApiKey ?? '',
          weatherApiHost: settingsRow.weatherApiHost ?? '',
          weatherCustomUrl: settingsRow.weatherCustomUrl ?? '',
          weatherCustomMapping: settingsRow.weatherCustomMapping ?? '',
          weatherAdcode: settingsRow.weatherAdcode ?? '',
          weatherLocationName: settingsRow.weatherLocationName ?? '',
          weatherFallbackMessage: '',
        }
      : { ...DEFAULT_SETTINGS };

    const wallpaperList: Wallpaper[] = wallpaperRows.map((w) => ({
      id: w.id,
      name: w.name,
      filePath: w.filePath ?? null,
      downloadUrl: w.downloadUrl ?? null,
      sortOrder: w.sortOrder,
      isDefault: w.isDefault,
    }));

    const groupList: NavGroup[] = groupRows.map((g) => ({
      id: g.id,
      name: g.name,
      sortOrder: g.sortOrder,
    }));

    const cardList: NavCard[] = cardRows.map((c) => ({
      id: c.id,
      name: c.name,
      url: c.url,
      icon: c.icon ?? null,
      iconType: c.iconType as 'emoji' | 'image' | 'favicon',
      groupId: c.groupId ?? null,
      sortOrder: c.sortOrder,
      intranetUrl: c.intranetUrl ?? '',
      extranetUrl: c.extranetUrl ?? '',
    }));

    return {
      version: '1.0',
      data: {
        cards: cardList,
        groups: groupList,
        wallpapers: wallpaperList,
        settings,
      },
    };
  }

  async importData(
    mode: 'overwrite' | 'merge',
    data: ExportDataResponse['data'],
    userId?: string,
  ): Promise<ImportDataResponse> {
    const ownerId = userId ?? 'public';
    const result: ImportDataResponse = {
      cards: 0,
      groups: 0,
      wallpapers: 0,
      settings: false,
    };

    this.db.transaction((tx) => {
      // Import settings
      if (data.settings) {
        if (userId) {
          const row = this.ensureUserSettingsRow(userId);
          tx.update(userSettings)
            .set({
              wallpaperInterval: data.settings.wallpaperInterval,
              wallpaperEnabled: data.settings.wallpaperEnabled,
              searchEngine: data.settings.searchEngine,
              clock24h: data.settings.clock24h,
              showSeconds: data.settings.showSeconds,
              wallpaperApiEnabled: data.settings.wallpaperApiEnabled ?? false,
              wallpaperApiUrl: data.settings.wallpaperApiUrl ?? '',
              wallpaperApiRefreshOnLoad:
                data.settings.wallpaperApiRefreshOnLoad ?? false,
              natEnabled: data.settings.natEnabled ?? false,
              natIntranetPrefix: data.settings.natIntranetPrefix ?? '',
              natExtranetPrefix: data.settings.natExtranetPrefix ?? '',
              weatherEnabled: data.settings.weatherEnabled ?? true,
              weatherLocation: data.settings.weatherLocation ?? '',
              weatherUnit: data.settings.weatherUnit ?? 'c',
              weatherRefreshInterval: data.settings.weatherRefreshInterval ?? 30,
              weatherProvider: data.settings.weatherProvider ?? 'wttr',
              weatherApiKey: data.settings.weatherApiKey ?? '',
              weatherApiHost: data.settings.weatherApiHost ?? '',
              weatherCustomUrl: data.settings.weatherCustomUrl ?? '',
              weatherCustomMapping: data.settings.weatherCustomMapping ?? '',
              weatherAdcode: data.settings.weatherAdcode ?? '',
              weatherLocationName: data.settings.weatherLocationName ?? '',
            })
            .where(eq(userSettings.id, row.id))
            .run();
        } else {
          const row = this.ensureAppSettingsRow();
          tx.update(appSettings)
            .set({
              wallpaperInterval: data.settings.wallpaperInterval,
              wallpaperEnabled: data.settings.wallpaperEnabled,
              searchEngine: data.settings.searchEngine,
              clock24h: data.settings.clock24h,
              showSeconds: data.settings.showSeconds,
              wallpaperApiEnabled: data.settings.wallpaperApiEnabled ?? false,
              wallpaperApiUrl: data.settings.wallpaperApiUrl ?? '',
              wallpaperApiRefreshOnLoad:
                data.settings.wallpaperApiRefreshOnLoad ?? false,
              natEnabled: data.settings.natEnabled ?? false,
              natIntranetPrefix: data.settings.natIntranetPrefix ?? '',
              natExtranetPrefix: data.settings.natExtranetPrefix ?? '',
              weatherEnabled: data.settings.weatherEnabled ?? true,
              weatherLocation: data.settings.weatherLocation ?? '',
              weatherUnit: data.settings.weatherUnit ?? 'c',
              weatherRefreshInterval: data.settings.weatherRefreshInterval ?? 30,
              weatherProvider: data.settings.weatherProvider ?? 'wttr',
              weatherApiKey: data.settings.weatherApiKey ?? '',
              weatherApiHost: data.settings.weatherApiHost ?? '',
              weatherCustomUrl: data.settings.weatherCustomUrl ?? '',
              weatherCustomMapping: data.settings.weatherCustomMapping ?? '',
              weatherAdcode: data.settings.weatherAdcode ?? '',
              weatherLocationName: data.settings.weatherLocationName ?? '',
            })
            .where(eq(appSettings.id, row.id))
            .run();
        }
        result.settings = true;
      }

      // Import wallpapers
      if (data.wallpapers && data.wallpapers.length > 0) {
        if (mode === 'overwrite') {
          tx.delete(wallpapers)
            .where(eq(wallpapers.userId, ownerId))
            .run();
        }
        const wallpaperValues = data.wallpapers.map((w) => ({
          id: w.id,
          userId: ownerId,
          name: w.name,
          filePath: w.filePath ?? null,
          downloadUrl: w.downloadUrl ?? null,
          sortOrder: w.sortOrder,
          isDefault: w.isDefault,
        }));
        for (const wv of wallpaperValues) {
          tx.insert(wallpapers)
            .values(wv)
            .onConflictDoUpdate({
              target: wallpapers.id,
              set: {
                name: wv.name,
                filePath: wv.filePath,
                downloadUrl: wv.downloadUrl,
                sortOrder: wv.sortOrder,
                isDefault: wv.isDefault,
              },
            })
            .run();
        }
        result.wallpapers = wallpaperValues.length;
      }

      // Import groups
      if (data.groups && data.groups.length > 0) {
        if (mode === 'overwrite') {
          // clear cards first due to FK
          tx.delete(navCards)
            .where(eq(navCards.userId, ownerId))
            .run();
          tx.delete(navGroups)
            .where(eq(navGroups.userId, ownerId))
            .run();
        }
        const groupValues = data.groups.map((g) => ({
          id: g.id,
          userId: ownerId,
          name: g.name,
          sortOrder: g.sortOrder,
        }));
        for (const gv of groupValues) {
          tx.insert(navGroups)
            .values(gv)
            .onConflictDoUpdate({
              target: navGroups.id,
              set: {
                name: gv.name,
                sortOrder: gv.sortOrder,
              },
            })
            .run();
        }
        result.groups = groupValues.length;
      }

      // Import cards
      if (data.cards && data.cards.length > 0) {
        if (mode === 'overwrite') {
          tx.delete(navCards)
            .where(eq(navCards.userId, ownerId))
            .run();
        }
        for (const c of data.cards) {
          const cv = {
            id: c.id,
            userId: ownerId,
            name: c.name,
            url: c.url,
            icon: c.icon ?? null,
            iconType: c.iconType,
            groupId: c.groupId ?? null,
            sortOrder: c.sortOrder,
            intranetUrl: (c as { intranetUrl?: string }).intranetUrl ?? '',
            extranetUrl: (c as { extranetUrl?: string }).extranetUrl ?? '',
          };
          tx.insert(navCards)
            .values(cv)
            .onConflictDoUpdate({
              target: navCards.id,
              set: {
                name: cv.name,
                url: cv.url,
                icon: cv.icon,
                iconType: cv.iconType,
                groupId: cv.groupId,
                sortOrder: cv.sortOrder,
              },
            })
            .run();
        }
        result.cards = data.cards.length;
      }
    });

    return result;
  }
}
