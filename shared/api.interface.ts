/* 前后端共享的类型定义 */

// ============ Nav Card ============
export interface NavCard {
  id: string;
  name: string;
  url: string;
  icon: string | null;
  iconType: 'emoji' | 'image' | 'favicon';
  groupId: string | null;
  sortOrder: number;
  intranetUrl: string;
  extranetUrl: string;
}

export interface NavGroup {
  id: string;
  name: string;
  sortOrder: number;
}

export interface NavGroupWithCards extends NavGroup {
  cards: NavCard[];
}

export interface NavDataResponse {
  groups: NavGroupWithCards[];
  ungrouped: NavCard[];
}

export interface CreateCardRequest {
  name: string;
  url: string;
  icon?: string;
  iconType?: 'emoji' | 'image' | 'favicon';
  groupId?: string | null;
  sortOrder?: number;
  intranetUrl?: string;
  extranetUrl?: string;
}

export interface UpdateCardRequest {
  name?: string;
  url?: string;
  icon?: string;
  iconType?: 'emoji' | 'image' | 'favicon';
  groupId?: string | null;
  sortOrder?: number;
  intranetUrl?: string;
  extranetUrl?: string;
}

export interface CreateGroupRequest {
  name: string;
  sortOrder?: number;
}

export interface UpdateGroupRequest {
  name?: string;
  sortOrder?: number;
}

export interface ReorderCardsRequest {
  items: { id: string; sortOrder: number; groupId: string | null }[];
}

// ============ Wallpaper ============
export interface ApiRandomResponse {
  fallback: boolean;
  imageData?: string;
  source?: string;
}

export interface Wallpaper {
  id: string;
  name: string;
  filePath: string | null;
  downloadUrl: string | null;
  sortOrder: number;
  isDefault: boolean;
}

export interface CreateWallpaperRequest {
  name: string;
  filePath?: string;
  downloadUrl?: string;
  sortOrder?: number;
}

export interface UpdateWallpaperRequest {
  name?: string;
  sortOrder?: number;
  isDefault?: boolean;
}

// ============ App Settings ============
export interface AppSettings {
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
  weatherFallbackMessage: string;
}

export interface PublicSettingsResponse {
  settings: AppSettings;
  wallpapers: Wallpaper[];
}

export interface UpdateSettingsRequest {
  wallpaperInterval?: number;
  wallpaperEnabled?: boolean;
  searchEngine?: string;
  clock24h?: boolean;
  showSeconds?: boolean;
  wallpaperApiEnabled?: boolean;
  wallpaperApiUrl?: string;
  wallpaperApiRefreshOnLoad?: boolean;
  natEnabled?: boolean;
  natIntranetPrefix?: string;
  natExtranetPrefix?: string;
  weatherEnabled?: boolean;
  weatherLocation?: string;
  weatherUnit?: 'c' | 'f';
  weatherRefreshInterval?: number;
  weatherProvider?: 'wttr' | 'qweather' | 'amap' | 'seniverse' | 'custom';
  weatherApiKey?: string;
  weatherApiHost?: string;
  weatherCustomUrl?: string;
  weatherCustomMapping?: string;
  weatherAdcode?: string;
  weatherLocationName?: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface VerifyPasswordRequest {
  password: string;
}

export interface VerifyPasswordResponse {
  success: boolean;
  token?: string;
}

export interface StorageInfo {
  dataDir: string;
  dbPath: string;
  dbSize: number;
}

// ============ Auth / User ============
export interface NavUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'user';
}

export interface AuthResponse {
  user: NavUser;
  token: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  displayName?: string;
}

// ============ Weather ============
export interface WeatherForecastDay {
  date: string;
  icon: string;
  condition: string;
  tempHigh: number;
  tempLow: number;
  wind?: number;
  windDir?: string;
}

export interface WeatherData {
  location: string;
  condition: string;
  conditionCode: string;
  temperature: number;
  feelsLike: number;
  tempHigh: number;
  tempLow: number;
  humidity: number;
  wind: number;
  windDir: string;
  icon: string;
  aqi?: number;
  aqiLevel?: string;
  updatedAt?: string;
  source?: string;
  forecast?: WeatherForecastDay[];
  latitude?: number;
  longitude?: number;
}

export interface WeatherResponse {
  ok: boolean;
  data?: WeatherData;
  message?: string;
  fallback?: boolean;
  fallbackReason?: string;
}

export interface WeatherQueryParams {
  location?: string;
  unit?: 'c' | 'f';
  adcode?: string;
  lat?: number;
  lon?: number;
}

export interface WeatherTestResponse {
  ok: boolean;
  message: string;
  sampleData?: WeatherData;
}

// ============ Export / Import ============
export interface ExportDataResponse {
  version: string;
  data: {
    cards: NavCard[];
    groups: NavGroup[];
    wallpapers: Wallpaper[];
    settings: AppSettings;
  };
}

export interface ImportDataRequest {
  mode: 'overwrite' | 'merge';
  data: ExportDataResponse['data'];
}

export interface ImportDataResponse {
  cards: number;
  groups: number;
  wallpapers: number;
  settings: boolean;
}

// ============ Widget Layout ============
export type WidgetType = 'clock' | 'date' | 'weather' | 'search' | 'nav_card' | 'group_title';

export interface Widget {
  id: string;
  widgetType: WidgetType;
  title?: string;
  config: Record<string, any>;
  gridCol: number;
  gridRow: number;
  sizeW: number;
  sizeH: number;
  sortOrder: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WidgetLayout {
  widgets: Widget[];
  gridCols: number; // 6 桌面 / 4 平板 / 2 手机
}

export interface CreateWidgetRequest {
  widgetType: WidgetType;
  title?: string;
  config?: Record<string, any>;
  gridCol: number;
  gridRow: number;
  sizeW: number;
  sizeH: number;
}

export interface UpdateWidgetRequest {
  title?: string;
  config?: Record<string, any>;
  gridCol?: number;
  gridRow?: number;
  sizeW?: number;
  sizeH?: number;
  sortOrder?: number;
}

export interface BatchUpdateLayoutRequest {
  widgets: Array<{
    id: string;
    gridCol: number;
    gridRow: number;
    sizeW: number;
    sizeH: number;
  }>;
}

export interface ResetLayoutRequest {
  template?: 'default' | 'compact' | 'dense';
}

export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl';

// ============ Geo / Location ============
export interface IpLocationResult {
  ok: boolean;
  country?: string;
  province?: string;
  city?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
  message?: string;
}

export interface GeoSearchResult {
  adcode: string;
  name: string;
  fullName: string;
  level: 'province' | 'city' | 'district';
}

export interface ReverseGeoResult {
  ok: boolean;
  province?: string;
  city?: string;
  district?: string;
  adcode?: string;
  fullName?: string;
  message?: string;
}

