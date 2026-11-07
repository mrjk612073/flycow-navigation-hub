import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  AppSettings,
  PublicSettingsResponse,
  UpdateSettingsRequest,
  VerifyPasswordResponse,
  StorageInfo,
  ExportDataResponse,
  ImportDataResponse,
  ImportDataRequest,
} from '@shared/api.interface';

// ============ Token 管理 ============

const EDIT_TOKEN_KEY = 'compass_edit_token';
const AUTH_TOKEN_KEY = 'compass_auth_token';
const LOCAL_EDIT_KEY = 'compass_local_edit';

// --- 编辑令牌（公共页密码模式） ---

export function getEditToken(): string | null {
  return localStorage.getItem(EDIT_TOKEN_KEY);
}

export function setEditToken(token: string): void {
  localStorage.setItem(EDIT_TOKEN_KEY, token);
}

export function clearEditToken(): void {
  localStorage.removeItem(EDIT_TOKEN_KEY);
}

export function isLocalEditMode(): boolean {
  return localStorage.getItem(LOCAL_EDIT_KEY) === '1';
}

export function setLocalEditMode(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(LOCAL_EDIT_KEY, '1');
  } else {
    localStorage.removeItem(LOCAL_EDIT_KEY);
  }
}

// --- 鉴权 Token（登录用户 JWT） ---

export function getAuthToken(): string | null {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return null;
  if (!isAuthTokenValid()) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return null;
  }
  return token;
}

export function isAuthTokenValid(): boolean {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return isAuthTokenValid();
}

// ============ 共享 Header 工具 ============

/**
 * 鉴权优先级：
 * 1. 有 JWT auth token → x-app-auth: Bearer <token>（用户登录态）
 * 2. 有 edit token → x-edit-token: <token>（公共页密码编辑模式）
 * 3. 都没有 → 空 headers（公共只读访问）
 */
export function authHeaders(): Record<string, string> {
  const authToken = getAuthToken();
  if (authToken) {
    return { 'x-app-auth': `Bearer ${authToken}` };
  }
  const editToken = getEditToken();
  if (editToken) {
    return { 'x-edit-token': editToken };
  }
  return {};
}

// ============ 默认设置 ============

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

function notifyFallback(message: string): void {
  logger.warn('后端不可用，已降级到默认设置', message);
  window.dispatchEvent(new CustomEvent('api:fallback', { detail: { message } }));
}

// ============ 公共读接口（后端优先，失败降级） ============

export async function getPublicSettings(): Promise<PublicSettingsResponse> {
  try {
    const res = await axiosForBackend.get('/api/settings/public');
    return res.data;
  } catch (err) {
    notifyFallback('设置加载失败，已使用默认配置');
    return {
      settings: { ...DEFAULT_SETTINGS },
      wallpapers: [],
    };
  }
}

// ============ 公共写接口（失败正常抛错） ============

export async function verifyPassword(password: string): Promise<VerifyPasswordResponse> {
  const res = await axiosForBackend.post('/api/settings/verify-password', { password });
  return res.data;
}

export async function updateSettings(data: UpdateSettingsRequest): Promise<AppSettings> {
  const res = await axiosForBackend.patch('/api/settings', data, {
    headers: authHeaders(),
  });
  return res.data;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean }> {
  const res = await axiosForBackend.post(
    '/api/settings/change-password',
    { oldPassword, newPassword },
    { headers: authHeaders() },
  );
  return res.data;
}

export async function exportData(): Promise<ExportDataResponse> {
  const res = await axiosForBackend.get('/api/settings/export', {
    headers: authHeaders(),
  });
  return res.data;
}

export async function importData(data: ImportDataRequest): Promise<ImportDataResponse> {
  const res = await axiosForBackend.post('/api/settings/import', data, {
    headers: authHeaders(),
  });
  return res.data;
}

// ============ 用户设置接口 ============

export async function getUserSettings(): Promise<AppSettings> {
  try {
    const res = await axiosForBackend.get('/api/settings/user', { headers: authHeaders() });
    return res.data;
  } catch (err) {
    notifyFallback('用户设置加载失败，已使用默认配置');
    return { ...DEFAULT_SETTINGS };
  }
}

export async function updateUserSettings(data: UpdateSettingsRequest): Promise<AppSettings> {
  const res = await axiosForBackend.patch('/api/settings/user', data, {
    headers: authHeaders(),
  });
  return res.data;
}

export async function exportUserData(): Promise<ExportDataResponse> {
  const res = await axiosForBackend.get('/api/settings/user/export', {
    headers: authHeaders(),
  });
  return res.data;
}

export async function importUserData(data: ImportDataRequest): Promise<ImportDataResponse> {
  const res = await axiosForBackend.post('/api/settings/user/import', data, {
    headers: authHeaders(),
  });
  return res.data;
}

// ============ 存储信息 ============

export async function getStorageInfo(): Promise<StorageInfo> {
  const res = await axiosForBackend.get('/api/settings/storage-info', {
    headers: authHeaders(),
  });
  return res.data;
}
