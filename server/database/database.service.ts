import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './sqlite-schema';
import { sql, eq, count } from 'drizzle-orm';
import { createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';

export const SQLITE_DATABASE = 'SQLITE_DATABASE';
export type SQLiteDB = BetterSQLite3Database<typeof schema>;

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

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getDataDir(): string {
  const envPath = process.env.DATA_DIR || process.env.COMPASS_DATA_DIR;
  if (envPath) return envPath;
  const cwd = process.cwd();
  const dataDir = join(cwd, 'data');
  return dataDir;
}

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  public db: SQLiteDB;
  private sqlite: Database.Database;
  public dataDir: string;
  public dbPath: string;

  constructor() {
    this.dataDir = getDataDir();
    this.dbPath = join(this.dataDir, 'compass.db');

    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
      this.logger.log(`Created data directory: ${this.dataDir}`);
    }

    this.sqlite = new Database(this.dbPath);
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('foreign_keys = ON');

    this.db = drizzle(this.sqlite, { schema, logger: false });

    this.logger.log(`SQLite database ready at ${this.dbPath}`);

    this.ensureSchema();
    this.seedDefaultData();
  }

  private ensureSchema(): void {
    const createTables = [
      `CREATE TABLE IF NOT EXISTS nav_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS nav_groups (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'public',
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_public INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS nav_cards (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'public',
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        icon TEXT,
        icon_type TEXT NOT NULL DEFAULT 'emoji',
        group_id TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        intranet_url TEXT NOT NULL DEFAULT '',
        extranet_url TEXT NOT NULL DEFAULT '',
        is_public INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS wallpapers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'public',
        name TEXT NOT NULL,
        file_path TEXT,
        download_url TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_default INTEGER NOT NULL DEFAULT 0,
        is_public INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'public',
        edit_password_hash TEXT NOT NULL,
        wallpaper_interval INTEGER NOT NULL DEFAULT 300,
        wallpaper_enabled INTEGER NOT NULL DEFAULT 1,
        search_engine TEXT NOT NULL DEFAULT 'baidu',
        clock_24h INTEGER NOT NULL DEFAULT 1,
        show_seconds INTEGER NOT NULL DEFAULT 1,
        wallpaper_api_enabled INTEGER NOT NULL DEFAULT 0,
        wallpaper_api_url TEXT NOT NULL DEFAULT '',
        wallpaper_api_refresh_on_load INTEGER NOT NULL DEFAULT 0,
        nat_enabled INTEGER NOT NULL DEFAULT 0,
        nat_intranet_prefix TEXT NOT NULL DEFAULT '',
        nat_extranet_prefix TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS nav_widgets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'public',
        widget_type TEXT NOT NULL,
        title TEXT,
        config TEXT NOT NULL DEFAULT '{}',
        grid_col INTEGER NOT NULL DEFAULT 0,
        grid_row INTEGER NOT NULL DEFAULT 0,
        size_w INTEGER NOT NULL DEFAULT 1,
        size_h INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_public INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS user_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        wallpaper_interval INTEGER NOT NULL DEFAULT 300,
        wallpaper_enabled INTEGER NOT NULL DEFAULT 1,
        search_engine TEXT NOT NULL DEFAULT 'baidu',
        clock_24h INTEGER NOT NULL DEFAULT 1,
        show_seconds INTEGER NOT NULL DEFAULT 1,
        wallpaper_api_enabled INTEGER NOT NULL DEFAULT 0,
        wallpaper_api_url TEXT NOT NULL DEFAULT '',
        wallpaper_api_refresh_on_load INTEGER NOT NULL DEFAULT 0,
        nat_enabled INTEGER NOT NULL DEFAULT 0,
        nat_intranet_prefix TEXT NOT NULL DEFAULT '',
        nat_extranet_prefix TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    ];

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_nav_groups_user ON nav_groups(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_nav_groups_sort ON nav_groups(sort_order)',
      'CREATE INDEX IF NOT EXISTS idx_nav_cards_user ON nav_cards(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_nav_cards_group ON nav_cards(group_id)',
      'CREATE INDEX IF NOT EXISTS idx_nav_cards_sort ON nav_cards(sort_order)',
      'CREATE INDEX IF NOT EXISTS idx_wallpapers_user ON wallpapers(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_wallpapers_sort ON wallpapers(sort_order)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_user ON app_settings(user_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_nav_users_username ON nav_users(username)',
      'CREATE INDEX IF NOT EXISTS idx_nav_widgets_user ON nav_widgets(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_nav_widgets_position ON nav_widgets(user_id, grid_row, grid_col)',
    ];

    const statements = [...createTables, ...indexes];
    const transaction = this.sqlite.transaction(() => {
      for (const stmt of statements) {
        this.sqlite.exec(stmt);
      }
      // Weather columns (added incrementally, safe to re-run)
      const weatherAlters = [
        'ALTER TABLE app_settings ADD COLUMN weather_enabled INTEGER NOT NULL DEFAULT 1',
        "ALTER TABLE app_settings ADD COLUMN weather_location TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE app_settings ADD COLUMN weather_unit TEXT NOT NULL DEFAULT 'c'",
        'ALTER TABLE app_settings ADD COLUMN weather_refresh_interval INTEGER NOT NULL DEFAULT 30',
        "ALTER TABLE app_settings ADD COLUMN weather_provider TEXT NOT NULL DEFAULT 'wttr'",
        "ALTER TABLE app_settings ADD COLUMN weather_api_key TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE app_settings ADD COLUMN weather_api_host TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE app_settings ADD COLUMN weather_custom_url TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE app_settings ADD COLUMN weather_custom_mapping TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE app_settings ADD COLUMN weather_adcode TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE app_settings ADD COLUMN weather_location_name TEXT NOT NULL DEFAULT ''",
        'ALTER TABLE user_settings ADD COLUMN weather_enabled INTEGER NOT NULL DEFAULT 1',
        "ALTER TABLE user_settings ADD COLUMN weather_location TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE user_settings ADD COLUMN weather_unit TEXT NOT NULL DEFAULT 'c'",
        'ALTER TABLE user_settings ADD COLUMN weather_refresh_interval INTEGER NOT NULL DEFAULT 30',
        "ALTER TABLE user_settings ADD COLUMN weather_provider TEXT NOT NULL DEFAULT 'wttr'",
        "ALTER TABLE user_settings ADD COLUMN weather_api_key TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE user_settings ADD COLUMN weather_api_host TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE user_settings ADD COLUMN weather_custom_url TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE user_settings ADD COLUMN weather_custom_mapping TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE user_settings ADD COLUMN weather_adcode TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE user_settings ADD COLUMN weather_location_name TEXT NOT NULL DEFAULT ''",
      ];
      for (const stmt of weatherAlters) {
        try {
          this.sqlite.exec(stmt);
        } catch {
          // column already exists, ignore
        }
      }
    });
    transaction();
    this.logger.log('Database schema ensured');
  }

  private seedDefaultData(): void {
    const { navUsers, navGroups, navCards, wallpapers, appSettings, navWidgets } = schema;
    const now = new Date();

    const userCountRes = this.db.select({ count: count() }).from(navUsers).all();
    const userCount = userCountRes[0]?.count ?? 0;

    if (userCount === 0) {
      this.logger.log('Seeding default admin user...');
      const adminHash = hashPassword('admin123');
      this.db.insert(navUsers).values({
        id: genId('u'),
        username: 'admin',
        passwordHash: adminHash,
        displayName: '管理员',
        role: 'admin',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }).run();
    }

    const groupCountRes = this.db.select({ count: count() })
      .from(navGroups)
      .where(eq(navGroups.userId, 'public'))
      .all();
    const groupCount = groupCountRes[0]?.count ?? 0;

    if (groupCount === 0) {
      this.logger.log('Seeding default groups and cards...');
      const g1 = genId('g');
      const g2 = genId('g');
      const g3 = genId('g');

      this.db.insert(navGroups).values([
        { id: g1, userId: 'public', name: '常用网站', sortOrder: 0, isPublic: true, createdAt: now, updatedAt: now },
        { id: g2, userId: 'public', name: '工作工具', sortOrder: 1, isPublic: true, createdAt: now, updatedAt: now },
        { id: g3, userId: 'public', name: '娱乐休闲', sortOrder: 2, isPublic: true, createdAt: now, updatedAt: now },
      ]).run();

      this.db.insert(navCards).values([
        { id: genId('c'), userId: 'public', name: '百度', url: 'https://www.baidu.com', icon: '🔍', iconType: 'emoji', groupId: g1, sortOrder: 0, isPublic: true, createdAt: now, updatedAt: now },
        { id: genId('c'), userId: 'public', name: 'Google', url: 'https://www.google.com', icon: '🌐', iconType: 'emoji', groupId: g1, sortOrder: 1, isPublic: true, createdAt: now, updatedAt: now },
        { id: genId('c'), userId: 'public', name: 'Bilibili', url: 'https://www.bilibili.com', icon: '📺', iconType: 'emoji', groupId: g1, sortOrder: 2, isPublic: true, createdAt: now, updatedAt: now },
        { id: genId('c'), userId: 'public', name: 'GitHub', url: 'https://github.com', icon: '💻', iconType: 'emoji', groupId: g2, sortOrder: 0, isPublic: true, createdAt: now, updatedAt: now },
        { id: genId('c'), userId: 'public', name: '飞书', url: 'https://www.feishu.cn', icon: '📝', iconType: 'emoji', groupId: g2, sortOrder: 1, isPublic: true, createdAt: now, updatedAt: now },
        { id: genId('c'), userId: 'public', name: 'Notion', url: 'https://www.notion.so', icon: '📓', iconType: 'emoji', groupId: g2, sortOrder: 2, isPublic: true, createdAt: now, updatedAt: now },
        { id: genId('c'), userId: 'public', name: 'YouTube', url: 'https://www.youtube.com', icon: '🎬', iconType: 'emoji', groupId: g3, sortOrder: 0, isPublic: true, createdAt: now, updatedAt: now },
        { id: genId('c'), userId: 'public', name: '微博', url: 'https://weibo.com', icon: '🌞', iconType: 'emoji', groupId: g3, sortOrder: 1, isPublic: true, createdAt: now, updatedAt: now },
      ]).run();
    }

    const wpCountRes = this.db.select({ count: count() })
      .from(wallpapers)
      .where(eq(wallpapers.userId, 'public'))
      .all();
    const wpCount = wpCountRes[0]?.count ?? 0;

    if (wpCount === 0) {
      this.logger.log('Seeding default wallpapers...');
      this.db.insert(wallpapers).values([
        { id: genId('w'), userId: 'public', name: '默认壁纸1', filePath: null, downloadUrl: '', sortOrder: 0, isDefault: false, isPublic: true, createdAt: now, updatedAt: now },
        { id: genId('w'), userId: 'public', name: '默认壁纸2', filePath: null, downloadUrl: '', sortOrder: 1, isDefault: true, isPublic: true, createdAt: now, updatedAt: now },
        { id: genId('w'), userId: 'public', name: '默认壁纸3', filePath: null, downloadUrl: '', sortOrder: 2, isDefault: false, isPublic: true, createdAt: now, updatedAt: now },
      ]).run();
    }

    const settingsCountRes = this.db.select({ count: count() })
      .from(appSettings)
      .where(eq(appSettings.userId, 'public'))
      .all();
    const settingsCount = settingsCountRes[0]?.count ?? 0;

    const widgetCountRes = this.db.select({ count: count() })
      .from(navWidgets)
      .where(eq(navWidgets.userId, 'public'))
      .all();
    const widgetCount = widgetCountRes[0]?.count ?? 0;

    if (widgetCount === 0) {
      this.logger.log('Seeding default widget layout...');
      const publicCards = this.db
        .select({
          id: navCards.id,
          name: navCards.name,
          icon: navCards.icon,
          iconType: navCards.iconType,
          url: navCards.url,
          sortOrder: navCards.sortOrder,
        })
        .from(navCards)
        .where(eq(navCards.userId, 'public'))
        .orderBy(navCards.sortOrder, navCards.id)
        .all();

      const GRID_COLS = 6;
      const widgets: Array<typeof navWidgets.$inferInsert> = [];

      // Row 0: 时钟 (2×1, 居中 col=2)
      widgets.push({
        id: genId('wgt'),
        userId: 'public',
        widgetType: 'clock',
        title: null,
        config: JSON.stringify({ format: '24h', showSeconds: true }),
        gridCol: 2,
        gridRow: 0,
        sizeW: 2,
        sizeH: 1,
        sortOrder: 0,
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });

      // Row 1: 天气 (2×1, col=0) + 搜索框 (4×1, col=2)
      widgets.push({
        id: genId('wgt'),
        userId: 'public',
        widgetType: 'weather',
        title: null,
        config: JSON.stringify({ location: '', unit: 'c' }),
        gridCol: 0,
        gridRow: 1,
        sizeW: 2,
        sizeH: 1,
        sortOrder: 1,
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });
      widgets.push({
        id: genId('wgt'),
        userId: 'public',
        widgetType: 'search',
        title: null,
        config: JSON.stringify({ engine: 'baidu' }),
        gridCol: 2,
        gridRow: 1,
        sizeW: 4,
        sizeH: 1,
        sortOrder: 2,
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });

      // Row 2+: nav_card widgets（从第 2 行开始，每行 6 个自动排列）
      let cardIndex = 0;
      for (const card of publicCards) {
        const row = 2 + Math.floor(cardIndex / GRID_COLS);
        const col = cardIndex % GRID_COLS;
        widgets.push({
          id: genId('wgt'),
          userId: 'public',
          widgetType: 'nav_card',
          title: card.name,
          config: JSON.stringify({
            cardId: card.id,
            name: card.name,
            url: card.url,
            icon: card.icon,
            iconType: card.iconType,
          }),
          gridCol: col,
          gridRow: row,
          sizeW: 1,
          sizeH: 1,
          sortOrder: 10 + cardIndex,
          isPublic: true,
          createdAt: now,
          updatedAt: now,
        });
        cardIndex += 1;
      }

      if (widgets.length > 0) {
        this.db.insert(navWidgets).values(widgets).run();
      }
    }

    if (settingsCount === 0) {
      this.logger.log('Seeding default settings...');
      const editHash = hashPassword('admin123');
      this.db.insert(appSettings).values({
        id: genId('s'),
        userId: 'public',
        editPasswordHash: editHash,
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
        createdAt: now,
        updatedAt: now,
      }).run();
    }
  }

  getDb(): SQLiteDB {
    return this.db;
  }

  getDataDir(): string {
    return this.dataDir;
  }

  getDbPath(): string {
    return this.dbPath;
  }
}
