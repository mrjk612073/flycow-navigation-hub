import type { NavCard, NavGroup, NavGroupWithCards, Wallpaper, AppSettings } from '@shared/api.interface';

const STORAGE_KEYS = {
  cards: 'compass_cards',
  groups: 'compass_groups',
  wallpapers: 'compass_wallpapers',
  settings: 'compass_settings',
  cloudEnabled: 'compass_cloud_sync',
  editMode: 'compass_edit_mode',
};

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

const DEFAULT_GROUPS: NavGroup[] = [
  { id: 'g1', name: '常用网站', sortOrder: 0 },
  { id: 'g2', name: '工作工具', sortOrder: 1 },
  { id: 'g3', name: '娱乐休闲', sortOrder: 2 },
];

const DEFAULT_CARDS: NavCard[] = [
  { id: 'c1', name: '百度', url: 'https://www.baidu.com', icon: '🔍', iconType: 'emoji', groupId: 'g1', sortOrder: 0, intranetUrl: '', extranetUrl: '' },
  { id: 'c2', name: 'Google', url: 'https://www.google.com', icon: '🌐', iconType: 'emoji', groupId: 'g1', sortOrder: 1, intranetUrl: '', extranetUrl: '' },
  { id: 'c3', name: 'Bilibili', url: 'https://www.bilibili.com', icon: '📺', iconType: 'emoji', groupId: 'g1', sortOrder: 2, intranetUrl: '', extranetUrl: '' },
  { id: 'c4', name: 'GitHub', url: 'https://github.com', icon: '💻', iconType: 'emoji', groupId: 'g2', sortOrder: 0, intranetUrl: '', extranetUrl: '' },
  { id: 'c5', name: '飞书', url: 'https://www.feishu.cn', icon: '📝', iconType: 'emoji', groupId: 'g2', sortOrder: 1, intranetUrl: '', extranetUrl: '' },
  { id: 'c6', name: 'Notion', url: 'https://www.notion.so', icon: '📓', iconType: 'emoji', groupId: 'g2', sortOrder: 2, intranetUrl: '', extranetUrl: '' },
  { id: 'c7', name: 'YouTube', url: 'https://www.youtube.com', icon: '🎬', iconType: 'emoji', groupId: 'g3', sortOrder: 0, intranetUrl: '', extranetUrl: '' },
  { id: 'c8', name: '微博', url: 'https://weibo.com', icon: '🌞', iconType: 'emoji', groupId: 'g3', sortOrder: 1, intranetUrl: '', extranetUrl: '' },
];

const DEFAULT_WALLPAPERS: Wallpaper[] = [];

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function isCloudSyncEnabled(): boolean {
  return readJSON(STORAGE_KEYS.cloudEnabled, false);
}

export function setCloudSyncEnabled(enabled: boolean): void {
  writeJSON(STORAGE_KEYS.cloudEnabled, enabled);
}

export function isLocalEditMode(): boolean {
  return readJSON(STORAGE_KEYS.editMode, false);
}

export function setLocalEditMode(enabled: boolean): void {
  writeJSON(STORAGE_KEYS.editMode, enabled);
}

export function getNavData(): { groups: NavGroupWithCards[]; ungrouped: NavCard[] } {
  let groups = readJSON<NavGroup[]>(STORAGE_KEYS.groups, []);
  let cards = readJSON<NavCard[]>(STORAGE_KEYS.cards, []);

  if (groups.length === 0 && cards.length === 0) {
    groups = DEFAULT_GROUPS;
    cards = DEFAULT_CARDS;
    writeJSON(STORAGE_KEYS.groups, groups);
    writeJSON(STORAGE_KEYS.cards, cards);
  }

  const groupsWithCards: NavGroupWithCards[] = groups
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((g) => ({
      ...g,
      cards: cards
        .filter((c) => c.groupId === g.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));

  const ungrouped = cards
    .filter((c) => !c.groupId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return { groups: groupsWithCards, ungrouped };
}

export function getGroups(): NavGroup[] {
  let groups = readJSON<NavGroup[]>(STORAGE_KEYS.groups, []);
  if (groups.length === 0) {
    groups = DEFAULT_GROUPS;
    writeJSON(STORAGE_KEYS.groups, groups);
  }
  return [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function createGroup(name: string): NavGroup {
  const groups = readJSON<NavGroup[]>(STORAGE_KEYS.groups, []);
  const maxOrder = groups.reduce((max, g) => Math.max(max, g.sortOrder), -1);
  const group: NavGroup = {
    id: genId('g'),
    name,
    sortOrder: maxOrder + 1,
  };
  groups.push(group);
  writeJSON(STORAGE_KEYS.groups, groups);
  return group;
}

export function updateGroup(id: string, patch: Partial<NavGroup>): NavGroup {
  const groups = readJSON<NavGroup[]>(STORAGE_KEYS.groups, []);
  const idx = groups.findIndex((g) => g.id === id);
  if (idx === -1) throw new Error('分组不存在');
  groups[idx] = { ...groups[idx], ...patch };
  writeJSON(STORAGE_KEYS.groups, groups);
  return groups[idx];
}

export function deleteGroup(id: string): void {
  const groups = readJSON<NavGroup[]>(STORAGE_KEYS.groups, []);
  writeJSON(STORAGE_KEYS.groups, groups.filter((g) => g.id !== id));
  const cards = readJSON<NavCard[]>(STORAGE_KEYS.cards, []);
  writeJSON(
    STORAGE_KEYS.cards,
    cards.filter((c) => c.groupId !== id),
  );
}

export function createCard(card: Omit<NavCard, 'id' | 'sortOrder'> & { sortOrder?: number }): NavCard {
  const cards = readJSON<NavCard[]>(STORAGE_KEYS.cards, []);
  const groupCards = card.groupId
    ? cards.filter((c) => c.groupId === card.groupId)
    : cards.filter((c) => !c.groupId);
  const maxOrder = groupCards.reduce((max, c) => Math.max(max, c.sortOrder), -1);
  const newCard: NavCard = {
    ...card,
    id: genId('c'),
    sortOrder: card.sortOrder ?? maxOrder + 1,
  };
  cards.push(newCard);
  writeJSON(STORAGE_KEYS.cards, cards);
  return newCard;
}

export function updateCard(id: string, patch: Partial<NavCard>): NavCard {
  const cards = readJSON<NavCard[]>(STORAGE_KEYS.cards, []);
  const idx = cards.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('卡片不存在');
  cards[idx] = { ...cards[idx], ...patch };
  writeJSON(STORAGE_KEYS.cards, cards);
  return cards[idx];
}

export function deleteCard(id: string): void {
  const cards = readJSON<NavCard[]>(STORAGE_KEYS.cards, []);
  writeJSON(STORAGE_KEYS.cards, cards.filter((c) => c.id !== id));
}

export function reorderCards(cardIds: string[]): void {
  const cards = readJSON<NavCard[]>(STORAGE_KEYS.cards, []);
  cardIds.forEach((id, index) => {
    const card = cards.find((c) => c.id === id);
    if (card) card.sortOrder = index;
  });
  writeJSON(STORAGE_KEYS.cards, cards);
}

export function getWallpapers(): Wallpaper[] {
  const wallpapers = readJSON<Wallpaper[]>(STORAGE_KEYS.wallpapers, []);
  return [...wallpapers].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function createWallpaper(data: Omit<Wallpaper, 'id' | 'sortOrder'>): Wallpaper {
  const wallpapers = readJSON<Wallpaper[]>(STORAGE_KEYS.wallpapers, []);
  const maxOrder = wallpapers.reduce((max, w) => Math.max(max, w.sortOrder), -1);
  const wp: Wallpaper = {
    ...data,
    id: genId('w'),
    sortOrder: maxOrder + 1,
  };
  wallpapers.push(wp);
  writeJSON(STORAGE_KEYS.wallpapers, wallpapers);
  return wp;
}

export function updateWallpaper(id: string, patch: Partial<Wallpaper>): Wallpaper {
  const wallpapers = readJSON<Wallpaper[]>(STORAGE_KEYS.wallpapers, []);
  const idx = wallpapers.findIndex((w) => w.id === id);
  if (idx === -1) throw new Error('壁纸不存在');

  if (patch.isDefault) {
    wallpapers.forEach((w) => { w.isDefault = false; });
  }

  wallpapers[idx] = { ...wallpapers[idx], ...patch };
  writeJSON(STORAGE_KEYS.wallpapers, wallpapers);
  return wallpapers[idx];
}

export function deleteWallpaper(id: string): void {
  const wallpapers = readJSON<Wallpaper[]>(STORAGE_KEYS.wallpapers, []);
  writeJSON(STORAGE_KEYS.wallpapers, wallpapers.filter((w) => w.id !== id));
}

export function getSettings(): AppSettings {
  const settings = readJSON<Partial<AppSettings>>(STORAGE_KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...settings };
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated = { ...current, ...patch };
  writeJSON(STORAGE_KEYS.settings, updated);
  return updated;
}

export function exportAllData(): string {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    cards: readJSON(STORAGE_KEYS.cards, []),
    groups: readJSON(STORAGE_KEYS.groups, []),
    wallpapers: readJSON(STORAGE_KEYS.wallpapers, []),
    settings: getSettings(),
  }, null, 2);
}

export function importData(json: string, mode: 'overwrite' | 'merge' = 'merge'): void {
  const data = JSON.parse(json);
  if (mode === 'overwrite') {
    if (data.cards) writeJSON(STORAGE_KEYS.cards, data.cards);
    if (data.groups) writeJSON(STORAGE_KEYS.groups, data.groups);
    if (data.wallpapers) writeJSON(STORAGE_KEYS.wallpapers, data.wallpapers);
    if (data.settings) writeJSON(STORAGE_KEYS.settings, data.settings);
  } else {
    if (data.cards?.length) {
      const existing = readJSON<NavCard[]>(STORAGE_KEYS.cards, []);
      const existingIds = new Set(existing.map((c) => c.id));
      const merged = [...existing, ...data.cards.filter((c: NavCard) => !existingIds.has(c.id))];
      writeJSON(STORAGE_KEYS.cards, merged);
    }
    if (data.groups?.length) {
      const existing = readJSON<NavGroup[]>(STORAGE_KEYS.groups, []);
      const existingIds = new Set(existing.map((g) => g.id));
      const merged = [...existing, ...data.groups.filter((g: NavGroup) => !existingIds.has(g.id))];
      writeJSON(STORAGE_KEYS.groups, merged);
    }
    if (data.wallpapers?.length) {
      const existing = readJSON<Wallpaper[]>(STORAGE_KEYS.wallpapers, []);
      const existingIds = new Set(existing.map((w) => w.id));
      const merged = [...existing, ...data.wallpapers.filter((w: Wallpaper) => !existingIds.has(w.id))];
      writeJSON(STORAGE_KEYS.wallpapers, merged);
    }
    if (data.settings) {
      const current = getSettings();
      writeJSON(STORAGE_KEYS.settings, { ...current, ...data.settings });
    }
  }
}
