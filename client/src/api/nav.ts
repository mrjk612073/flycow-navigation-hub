import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { authHeaders } from './settings';
import type {
  NavDataResponse,
  NavCard,
  NavGroup,
  NavGroupWithCards,
  CreateCardRequest,
  UpdateCardRequest,
  CreateGroupRequest,
  UpdateGroupRequest,
  ReorderCardsRequest,
} from '@shared/api.interface';

// ============ 示例数据（与后端种子数据一致） ============
const SAMPLE_GROUPS: NavGroup[] = [
  { id: 'g1', name: '常用网站', sortOrder: 0 },
  { id: 'g2', name: '工作工具', sortOrder: 1 },
  { id: 'g3', name: '娱乐休闲', sortOrder: 2 },
];

const SAMPLE_CARDS: NavCard[] = [
  { id: 'c1', name: '百度', url: 'https://www.baidu.com', icon: '🔍', iconType: 'emoji', groupId: 'g1', sortOrder: 0, intranetUrl: '', extranetUrl: '' },
  { id: 'c2', name: 'Google', url: 'https://www.google.com', icon: '🌐', iconType: 'emoji', groupId: 'g1', sortOrder: 1, intranetUrl: '', extranetUrl: '' },
  { id: 'c3', name: 'Bilibili', url: 'https://www.bilibili.com', icon: '📺', iconType: 'emoji', groupId: 'g1', sortOrder: 2, intranetUrl: '', extranetUrl: '' },
  { id: 'c4', name: 'GitHub', url: 'https://github.com', icon: '💻', iconType: 'emoji', groupId: 'g2', sortOrder: 0, intranetUrl: '', extranetUrl: '' },
  { id: 'c5', name: '飞书', url: 'https://www.feishu.cn', icon: '📝', iconType: 'emoji', groupId: 'g2', sortOrder: 1, intranetUrl: '', extranetUrl: '' },
  { id: 'c6', name: 'Notion', url: 'https://www.notion.so', icon: '📓', iconType: 'emoji', groupId: 'g2', sortOrder: 2, intranetUrl: '', extranetUrl: '' },
  { id: 'c7', name: 'YouTube', url: 'https://www.youtube.com', icon: '🎬', iconType: 'emoji', groupId: 'g3', sortOrder: 0, intranetUrl: '', extranetUrl: '' },
  { id: 'c8', name: '微博', url: 'https://weibo.com', icon: '🌞', iconType: 'emoji', groupId: 'g3', sortOrder: 1, intranetUrl: '', extranetUrl: '' },
];

function buildSampleNavData(): NavDataResponse {
  const groups: NavGroupWithCards[] = SAMPLE_GROUPS
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((g) => ({
      ...g,
      cards: SAMPLE_CARDS
        .filter((c) => c.groupId === g.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  const ungrouped = SAMPLE_CARDS
    .filter((c) => !c.groupId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return { groups, ungrouped };
}

function notifyFallback(message: string): void {
  logger.warn('后端不可用，已降级到示例数据', message);
  window.dispatchEvent(new CustomEvent('api:fallback', { detail: { message } }));
}

// ============ 公共读接口（后端优先，失败降级到示例数据） ============

export async function getNavData(): Promise<NavDataResponse> {
  try {
    const res = await axiosForBackend.get('/api/nav/all');
    return res.data;
  } catch (err) {
    notifyFallback('导航数据加载失败，已显示示例数据');
    return buildSampleNavData();
  }
}

export async function getGroups(): Promise<NavGroup[]> {
  try {
    const res = await axiosForBackend.get('/api/nav/groups');
    return res.data;
  } catch (err) {
    notifyFallback('分组数据加载失败，已显示示例分组');
    return [...SAMPLE_GROUPS].sort((a, b) => a.sortOrder - b.sortOrder);
  }
}

// ============ 公共写接口（失败正常抛错） ============

export async function createGroup(data: CreateGroupRequest): Promise<NavGroup> {
  const res = await axiosForBackend.post('/api/nav/groups', data, { headers: authHeaders() });
  return res.data;
}

export async function updateGroup(id: string, data: UpdateGroupRequest): Promise<NavGroup> {
  const res = await axiosForBackend.patch(`/api/nav/groups/${id}`, data, { headers: authHeaders() });
  return res.data;
}

export async function deleteGroup(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/nav/groups/${id}`, { headers: authHeaders() });
}

export async function createCard(data: CreateCardRequest): Promise<NavCard> {
  const res = await axiosForBackend.post('/api/nav/cards', data, { headers: authHeaders() });
  return res.data;
}

export async function updateCard(id: string, data: UpdateCardRequest): Promise<NavCard> {
  const res = await axiosForBackend.patch(`/api/nav/cards/${id}`, data, { headers: authHeaders() });
  return res.data;
}

export async function deleteCard(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/nav/cards/${id}`, { headers: authHeaders() });
}

export async function reorderCards(data: ReorderCardsRequest): Promise<{ success: boolean }> {
  const res = await axiosForBackend.post('/api/nav/cards/reorder', data, { headers: authHeaders() });
  return res.data;
}

// ============ 用户空间接口（带 x-app-auth） ============

export async function getUserNavData(): Promise<NavDataResponse> {
  try {
    const res = await axiosForBackend.get('/api/nav/user/all', { headers: authHeaders() });
    return res.data;
  } catch (err) {
    notifyFallback('用户导航数据加载失败，已显示示例数据');
    return buildSampleNavData();
  }
}

export async function createUserGroup(data: CreateGroupRequest): Promise<NavGroup> {
  const res = await axiosForBackend.post('/api/nav/user/groups', data, { headers: authHeaders() });
  return res.data;
}

export async function updateUserGroup(id: string, data: UpdateGroupRequest): Promise<NavGroup> {
  const res = await axiosForBackend.patch(`/api/nav/user/groups/${id}`, data, { headers: authHeaders() });
  return res.data;
}

export async function deleteUserGroup(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/nav/user/groups/${id}`, { headers: authHeaders() });
}

export async function createUserCard(data: CreateCardRequest): Promise<NavCard> {
  const res = await axiosForBackend.post('/api/nav/user/cards', data, { headers: authHeaders() });
  return res.data;
}

export async function updateUserCard(id: string, data: UpdateCardRequest): Promise<NavCard> {
  const res = await axiosForBackend.patch(`/api/nav/user/cards/${id}`, data, { headers: authHeaders() });
  return res.data;
}

export async function deleteUserCard(id: string): Promise<void> {
  await axiosForBackend.delete(`/api/nav/user/cards/${id}`, { headers: authHeaders() });
}

export async function reorderUserCards(data: ReorderCardsRequest): Promise<{ success: boolean }> {
  const res = await axiosForBackend.post('/api/nav/user/cards/reorder', data, { headers: authHeaders() });
  return res.data;
}
