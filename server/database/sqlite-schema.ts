import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';

export const navUsers = sqliteTable(
  'nav_users',
  {
    id: text('id').primaryKey(),
    username: text('username', { length: 50 }).notNull().unique(),
    passwordHash: text('password_hash', { length: 255 }).notNull(),
    displayName: text('display_name', { length: 100 }).notNull(),
    role: text('role', { length: 20 }).notNull().default('user'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('nav_users_username_idx').on(table.username),
  ],
);

export const navGroups = sqliteTable(
  'nav_groups',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default('public'),
    name: text('name', { length: 100 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index('nav_groups_user_idx').on(table.userId),
    index('nav_groups_sort_idx').on(table.sortOrder),
  ],
);

export const navCards = sqliteTable(
  'nav_cards',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default('public'),
    name: text('name', { length: 100 }).notNull(),
    url: text('url', { length: 1000 }).notNull(),
    icon: text('icon', { length: 500 }),
    iconType: text('icon_type', { length: 20 }).notNull().default('emoji'),
    groupId: text('group_id'),
    sortOrder: integer('sort_order').notNull().default(0),
    intranetUrl: text('intranet_url', { length: 1000 }).notNull().default(''),
    extranetUrl: text('extranet_url', { length: 1000 }).notNull().default(''),
    isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index('nav_cards_user_idx').on(table.userId),
    index('nav_cards_group_idx').on(table.groupId),
    index('nav_cards_sort_idx').on(table.sortOrder),
  ],
);

export const wallpapers = sqliteTable(
  'wallpapers',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default('public'),
    name: text('name', { length: 255 }).notNull(),
    filePath: text('file_path', { length: 1000 }),
    downloadUrl: text('download_url', { length: 1000 }),
    sortOrder: integer('sort_order').notNull().default(0),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index('wallpapers_user_idx').on(table.userId),
    index('wallpapers_sort_idx').on(table.sortOrder),
  ],
);

export const appSettings = sqliteTable(
  'app_settings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default('public'),
    editPasswordHash: text('edit_password_hash', { length: 255 }).notNull(),
    wallpaperInterval: integer('wallpaper_interval').notNull().default(300),
    wallpaperEnabled: integer('wallpaper_enabled', { mode: 'boolean' }).notNull().default(true),
    searchEngine: text('search_engine', { length: 20 }).notNull().default('baidu'),
    clock24h: integer('clock_24h', { mode: 'boolean' }).notNull().default(true),
    showSeconds: integer('show_seconds', { mode: 'boolean' }).notNull().default(true),
    wallpaperApiEnabled: integer('wallpaper_api_enabled', { mode: 'boolean' }).notNull().default(false),
    wallpaperApiUrl: text('wallpaper_api_url', { length: 500 }).notNull().default(''),
    wallpaperApiRefreshOnLoad: integer('wallpaper_api_refresh_on_load', { mode: 'boolean' })
      .notNull()
      .default(false),
    natEnabled: integer('nat_enabled', { mode: 'boolean' }).notNull().default(false),
    natIntranetPrefix: text('nat_intranet_prefix', { length: 500 }).notNull().default(''),
    natExtranetPrefix: text('nat_extranet_prefix', { length: 500 }).notNull().default(''),
    weatherEnabled: integer('weather_enabled', { mode: 'boolean' }).notNull().default(true),
    weatherLocation: text('weather_location', { length: 200 }).notNull().default(''),
    weatherUnit: text('weather_unit', { length: 5 }).notNull().default('c'),
    weatherRefreshInterval: integer('weather_refresh_interval').notNull().default(30),
    weatherProvider: text('weather_provider', { length: 20 }).notNull().default('wttr'),
    weatherApiKey: text('weather_api_key', { length: 255 }).notNull().default(''),
    weatherApiHost: text('weather_api_host', { length: 255 }).notNull().default(''),
    weatherCustomUrl: text('weather_custom_url', { length: 1000 }).notNull().default(''),
    weatherCustomMapping: text('weather_custom_mapping', { length: 2000 }).notNull().default(''),
    weatherAdcode: text('weather_adcode', { length: 20 }).notNull().default(''),
    weatherLocationName: text('weather_location_name', { length: 100 }).notNull().default(''),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('app_settings_user_idx').on(table.userId),
  ],
);

export const userSettings = sqliteTable(
  'user_settings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().unique(),
    wallpaperInterval: integer('wallpaper_interval').notNull().default(300),
    wallpaperEnabled: integer('wallpaper_enabled', { mode: 'boolean' }).notNull().default(true),
    searchEngine: text('search_engine', { length: 20 }).notNull().default('baidu'),
    clock24h: integer('clock_24h', { mode: 'boolean' }).notNull().default(true),
    showSeconds: integer('show_seconds', { mode: 'boolean' }).notNull().default(true),
    wallpaperApiEnabled: integer('wallpaper_api_enabled', { mode: 'boolean' }).notNull().default(false),
    wallpaperApiUrl: text('wallpaper_api_url', { length: 500 }).notNull().default(''),
    wallpaperApiRefreshOnLoad: integer('wallpaper_api_refresh_on_load', { mode: 'boolean' })
      .notNull()
      .default(false),
    natEnabled: integer('nat_enabled', { mode: 'boolean' }).notNull().default(false),
    natIntranetPrefix: text('nat_intranet_prefix', { length: 500 }).notNull().default(''),
    natExtranetPrefix: text('nat_extranet_prefix', { length: 500 }).notNull().default(''),
    weatherEnabled: integer('weather_enabled', { mode: 'boolean' }).notNull().default(true),
    weatherLocation: text('weather_location', { length: 200 }).notNull().default(''),
    weatherUnit: text('weather_unit', { length: 5 }).notNull().default('c'),
    weatherRefreshInterval: integer('weather_refresh_interval').notNull().default(30),
    weatherProvider: text('weather_provider', { length: 20 }).notNull().default('wttr'),
    weatherApiKey: text('weather_api_key', { length: 255 }).notNull().default(''),
    weatherApiHost: text('weather_api_host', { length: 255 }).notNull().default(''),
    weatherCustomUrl: text('weather_custom_url', { length: 1000 }).notNull().default(''),
    weatherCustomMapping: text('weather_custom_mapping', { length: 2000 }).notNull().default(''),
    weatherAdcode: text('weather_adcode', { length: 20 }).notNull().default(''),
    weatherLocationName: text('weather_location_name', { length: 100 }).notNull().default(''),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('user_settings_user_idx').on(table.userId),
  ],
);

export const navWidgets = sqliteTable(
  'nav_widgets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default('public'),
    widgetType: text('widget_type', { length: 20 }).notNull(),
    title: text('title', { length: 100 }),
    config: text('config', { length: 2000 }).notNull().default('{}'),
    gridCol: integer('grid_col').notNull().default(0),
    gridRow: integer('grid_row').notNull().default(0),
    sizeW: integer('size_w').notNull().default(1),
    sizeH: integer('size_h').notNull().default(1),
    sortOrder: integer('sort_order').notNull().default(0),
    isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdateFn(() => new Date()),
  },
  (table) => [
    index('nav_widgets_user_idx').on(table.userId),
    index('nav_widgets_position_idx').on(table.userId, table.gridRow, table.gridCol),
  ],
);

export type NavUserTable = typeof navUsers.$inferSelect;
export type NavGroupTable = typeof navGroups.$inferSelect;
export type NavCardTable = typeof navCards.$inferSelect;
export type WallpaperTable = typeof wallpapers.$inferSelect;
export type AppSettingsTable = typeof appSettings.$inferSelect;
export type NavWidgetTable = typeof navWidgets.$inferSelect;
