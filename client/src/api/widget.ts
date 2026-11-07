import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { resolveAppUrl } from '@lark-apaas/client-toolkit/utils/resolveAppUrl';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { authHeaders, getAuthToken, clearAuthToken, isAuthTokenValid } from './settings';
import type {
  Widget,
  WidgetLayout,
  CreateWidgetRequest,
  UpdateWidgetRequest,
  BatchUpdateLayoutRequest,
} from '@shared/api.interface';

// ============ 默认布局示例数据 ============
function buildDefaultWidgets(): Widget[] {
  const now = new Date();
  return [
    {
      id: 'w-clock',
      widgetType: 'clock',
      config: {},
      gridCol: 1,
      gridRow: 1,
      sizeW: 2,
      sizeH: 1,
      sortOrder: 0,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'w-weather',
      widgetType: 'weather',
      config: {},
      gridCol: 3,
      gridRow: 1,
      sizeW: 2,
      sizeH: 1,
      sortOrder: 1,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'w-search',
      widgetType: 'search',
      config: {},
      gridCol: 5,
      gridRow: 1,
      sizeW: 2,
      sizeH: 1,
      sortOrder: 2,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'w-title-1',
      widgetType: 'group_title',
      title: '常用网站',
      config: {},
      gridCol: 1,
      gridRow: 2,
      sizeW: 6,
      sizeH: 1,
      sortOrder: 10,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'w-card-1',
      widgetType: 'nav_card',
      config: { cardId: 'c1', name: '百度', icon: '🔍', iconType: 'emoji', url: 'https://www.baidu.com' },
      gridCol: 1,
      gridRow: 3,
      sizeW: 1,
      sizeH: 1,
      sortOrder: 11,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'w-card-2',
      widgetType: 'nav_card',
      config: { cardId: 'c2', name: 'Google', icon: '🌐', iconType: 'emoji', url: 'https://www.google.com' },
      gridCol: 2,
      gridRow: 3,
      sizeW: 1,
      sizeH: 1,
      sortOrder: 12,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'w-card-3',
      widgetType: 'nav_card',
      config: { cardId: 'c3', name: 'Bilibili', icon: '📺', iconType: 'emoji', url: 'https://www.bilibili.com' },
      gridCol: 3,
      gridRow: 3,
      sizeW: 1,
      sizeH: 1,
      sortOrder: 13,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'w-card-4',
      widgetType: 'nav_card',
      config: { cardId: 'c4', name: 'GitHub', icon: '💻', iconType: 'emoji', url: 'https://github.com' },
      gridCol: 4,
      gridRow: 3,
      sizeW: 1,
      sizeH: 1,
      sortOrder: 14,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'w-card-5',
      widgetType: 'nav_card',
      config: { cardId: 'c5', name: '飞书', icon: '📝', iconType: 'emoji', url: 'https://www.feishu.cn' },
      gridCol: 5,
      gridRow: 3,
      sizeW: 1,
      sizeH: 1,
      sortOrder: 15,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'w-card-6',
      widgetType: 'nav_card',
      config: { cardId: 'c6', name: 'Notion', icon: '📓', iconType: 'emoji', url: 'https://www.notion.so' },
      gridCol: 6,
      gridRow: 3,
      sizeW: 1,
      sizeH: 1,
      sortOrder: 16,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'w-title-2',
      widgetType: 'group_title',
      title: '娱乐休闲',
      config: {},
      gridCol: 1,
      gridRow: 4,
      sizeW: 6,
      sizeH: 1,
      sortOrder: 20,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'w-card-7',
      widgetType: 'nav_card',
      config: { cardId: 'c7', name: 'YouTube', icon: '🎬', iconType: 'emoji', url: 'https://www.youtube.com' },
      gridCol: 1,
      gridRow: 5,
      sizeW: 1,
      sizeH: 1,
      sortOrder: 21,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'w-card-8',
      widgetType: 'nav_card',
      config: { cardId: 'c8', name: '微博', icon: '🌞', iconType: 'emoji', url: 'https://weibo.com' },
      gridCol: 2,
      gridRow: 5,
      sizeW: 1,
      sizeH: 1,
      sortOrder: 22,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function notifyFallback(message: string): void {
  logger.warn('Widget 后端不可用，已降级到默认布局', message);
}

// ============ 公共读接口 ============

function isUserLoggedIn(): boolean {
  return isAuthTokenValid();
}

function writePath(path: string): string {
  return isUserLoggedIn() ? `/api/widgets/user/${path}` : `/api/widgets/${path}`;
}

function fetchPublicLayout(): Promise<WidgetLayout> {
  return axiosForBackend.get('/api/widgets/public').then((r) => r.data);
}

export async function getWidgetLayout(): Promise<WidgetLayout> {
  if (isUserLoggedIn()) {
    return getUserWidgetLayout();
  }
  try {
    return await fetchPublicLayout();
  } catch (err) {
    notifyFallback('公共 Widget 布局加载失败');
    return { widgets: buildDefaultWidgets(), gridCols: 6 };
  }
}

async function fetchUserJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const url = resolveAppUrl(path);
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-app-auth': `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    (err as { response?: { status: number } }).response = { status: res.status };
    throw err;
  }
  return res.json();
}

export async function getUserWidgetLayout(): Promise<WidgetLayout> {
  try {
    const data = await fetchUserJson<WidgetLayout>('/api/widgets/user');
    return data;
  } catch (err: unknown) {
    const status = (err as { response?: { status: number } })?.response?.status;
    if (status === 401) {
      clearAuthToken();
      notifyFallback('登录已过期，已切换到公共布局');
      try {
        return await fetchPublicLayout();
      } catch {
        return { widgets: buildDefaultWidgets(), gridCols: 6 };
      }
    }
    notifyFallback('用户 Widget 布局加载失败');
    return { widgets: buildDefaultWidgets(), gridCols: 6 };
  }
}

// ============ 写接口 ============

export async function createWidget(data: CreateWidgetRequest): Promise<Widget> {
  const res = await axiosForBackend.post(writePath(''), data, { headers: authHeaders() });
  return res.data;
}

export async function updateWidget(id: string, data: UpdateWidgetRequest): Promise<Widget> {
  const path = isUserLoggedIn() ? `user/${id}` : id;
  const res = await axiosForBackend.patch(`/api/widgets/${path}`, data, { headers: authHeaders() });
  return res.data;
}

export async function deleteWidget(id: string): Promise<void> {
  const path = isUserLoggedIn() ? `user/${id}` : id;
  await axiosForBackend.delete(`/api/widgets/${path}`, { headers: authHeaders() });
}

export async function batchUpdateLayout(data: BatchUpdateLayoutRequest): Promise<{ success: boolean }> {
  const res = await axiosForBackend.post(writePath('batch-update'), data, { headers: authHeaders() });
  return res.data;
}

export async function resetLayout(template?: string): Promise<WidgetLayout> {
  const res = await axiosForBackend.post(
    writePath('reset'),
    template ? { template } : {},
    { headers: authHeaders() },
  );
  return res.data;
}
