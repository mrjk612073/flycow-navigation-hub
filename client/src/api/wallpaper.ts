import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { authHeaders } from './settings';
import type {
  Wallpaper,
  CreateWallpaperRequest,
  UpdateWallpaperRequest,
  ApiRandomResponse,
} from '@shared/api.interface';

function notifyFallback(message: string): void {
  logger.warn('后端不可用，已降级', message);
  window.dispatchEvent(new CustomEvent('api:fallback', { detail: { message } }));
}

// ============ 公共读接口（后端优先，失败降级） ============

export async function findAll(): Promise<Wallpaper[]> {
  try {
    const res = await axiosForBackend.get('/api/wallpapers');
    return res.data;
  } catch (err) {
    notifyFallback('壁纸数据加载失败');
    return [];
  }
}

// 兼容旧调用名
export { findAll as getWallpapers };

// ============ 公共写接口（失败正常抛错） ============

export async function create(data: CreateWallpaperRequest): Promise<Wallpaper> {
  const res = await axiosForBackend.post('/api/wallpapers', data, { headers: authHeaders() });
  return res.data;
}

export { create as createWallpaper };

export async function update(id: string, data: UpdateWallpaperRequest): Promise<Wallpaper> {
  const res = await axiosForBackend.patch(`/api/wallpapers/${id}`, data, { headers: authHeaders() });
  return res.data;
}

export { update as updateWallpaper };

export async function remove(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/wallpapers/${id}`, { headers: authHeaders() });
}

export { remove as deleteWallpaper };

// ============ 用户壁纸接口 ============

export async function findUserAll(): Promise<Wallpaper[]> {
  try {
    const res = await axiosForBackend.get('/api/wallpapers/user', { headers: authHeaders() });
    return res.data;
  } catch (err) {
    notifyFallback('用户壁纸加载失败');
    return [];
  }
}

export async function createUser(data: CreateWallpaperRequest): Promise<Wallpaper> {
  const res = await axiosForBackend.post('/api/wallpapers/user', data, { headers: authHeaders() });
  return res.data;
}

export async function updateUser(id: string, data: UpdateWallpaperRequest): Promise<Wallpaper> {
  const res = await axiosForBackend.patch(`/api/wallpapers/user/${id}`, data, { headers: authHeaders() });
  return res.data;
}

export async function removeUser(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/wallpapers/user/${id}`, { headers: authHeaders() });
}

// ============ API 随机壁纸 ============

export async function getApiRandomWallpaper(): Promise<ApiRandomResponse | null> {
  try {
    const res = await axiosForBackend.get('/api/wallpaper/api-random');
    return res.data;
  } catch (err) {
    notifyFallback('随机壁纸获取失败');
    return null;
  }
}
