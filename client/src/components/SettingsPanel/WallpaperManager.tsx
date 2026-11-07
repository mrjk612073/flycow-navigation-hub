import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Star,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  RefreshCw,
  Globe,
  Palette,
  Monitor,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { toast } from 'sonner';
import { Switch } from '@client/src/components/ui/switch';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Separator } from '@client/src/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import {
  getWallpapers,
  createWallpaper,
  deleteWallpaper,
  updateWallpaper,
  getApiRandomWallpaper,
} from '@client/src/api/wallpaper';
import { getPublicSettings, updateSettings } from '@client/src/api/settings';
import type { Wallpaper, AppSettings } from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';

const WALLPAPER_PRESETS = [
  { value: 'bing', label: '必应每日一图', url: 'https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN' },
  { value: 'scenery', label: '随机风景', url: 'https://t.alcy.cc/pc' },
  { value: 'anime', label: '随机二次元', url: 'https://api.btstu.cn/sjbz/api.php?format=images&lx=dongman' },
  { value: 'acg', label: '随机ACG', url: 'https://www.loliapi.com/acg/pc/' },
  { value: 'custom', label: '自定义', url: '' },
];

function getPresetValueFromUrl(url: string): string {
  const match = WALLPAPER_PRESETS.find((p) => p.url && p.url === url);
  return match ? match.value : 'custom';
}

export default function WallpaperManager() {
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [localSettings, setLocalSettings] = useState<Partial<AppSettings>>({});
  const [apiRefreshing, setApiRefreshing] = useState(false);
  const [apiStatus, setApiStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [customUrlInput, setCustomUrlInput] = useState('');

  const { data: wallpapers = [], isLoading: wallpapersLoading } = useQuery({
    queryKey: ['wallpapers'],
    queryFn: getWallpapers,
  });

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: getPublicSettings,
  });

  const settings: AppSettings = {
    ...settingsData?.settings,
    ...localSettings,
  } as AppSettings;

  const updateSettingMutation = useMutation({
    mutationFn: (patch: Partial<AppSettings>) => updateSettings(patch),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicSettings'] });
    },
    onError: (error: Error) => {
      logger.error('更新壁纸设置失败', error);
      toast.error('保存失败，请重试');
    },
  });

  const handleToggle = (key: keyof AppSettings, value: boolean) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    updateSettingMutation.mutate({ [key]: value } as Partial<AppSettings>);
  };

  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (isNaN(val) || val < 5) return;
    setLocalSettings((prev) => ({ ...prev, wallpaperInterval: val }));
  };

  const handleIntervalBlur = () => {
    if (localSettings.wallpaperInterval !== undefined) {
      updateSettingMutation.mutate({ wallpaperInterval: localSettings.wallpaperInterval });
    }
  };

  const handlePresetChange = (value: string) => {
    const preset = WALLPAPER_PRESETS.find((p) => p.value === value);
    if (!preset) return;
    setLocalSettings((prev) => ({
      ...prev,
      wallpaperApiUrl: preset.url,
    }));
    if (preset.url) {
      updateSettingMutation.mutate({ wallpaperApiUrl: preset.url });
    }
  };

  const handleCustomUrlBlur = () => {
    if (localSettings.wallpaperApiUrl !== undefined) {
      updateSettingMutation.mutate({
        wallpaperApiUrl: localSettings.wallpaperApiUrl,
      });
    }
  };

  const handleRefreshNow = async () => {
    if (!settings.wallpaperApiEnabled) return;
    setApiRefreshing(true);
    setApiStatus('idle');
    try {
      const res = await getApiRandomWallpaper();
      if (res?.imageData) {
        setApiStatus('success');
        toast.success('壁纸已刷新');
      } else {
        setApiStatus('error');
        toast.error('接口返回为空，已回退到本地壁纸');
      }
    } catch (err) {
      setApiStatus('error');
      logger.error('立即刷新壁纸失败', err);
      toast.error('刷新失败，请稍后重试');
    } finally {
      setApiRefreshing(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: () => {
      if (!newName.trim()) throw new Error('请输入名称');
      if (!newUrl.trim()) throw new Error('请输入图片 URL');
      return createWallpaper({
        name: newName.trim(),
        downloadUrl: newUrl.trim(),
        sortOrder: wallpapers.length,
      });
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallpapers'] });
      queryClient.invalidateQueries({ queryKey: ['publicSettings'] });
      toast.success('壁纸已添加');
      setAddDialogOpen(false);
      setNewName('');
      setNewUrl('');
    },
    onError: (error: Error) => {
      logger.error('添加壁纸失败', error);
      toast.error(error.message || '添加失败，请重试');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteWallpaper(id),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallpapers'] });
      queryClient.invalidateQueries({ queryKey: ['publicSettings'] });
      toast.success('壁纸已删除');
      setDeleteId(null);
    },
    onError: (error: Error) => {
      logger.error('删除壁纸失败', error);
      toast.error('删除失败，请重试');
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => updateWallpaper(id, { isDefault: true }),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallpapers'] });
      queryClient.invalidateQueries({ queryKey: ['publicSettings'] });
      toast.success('已设为默认壁纸');
    },
    onError: (error: Error) => {
      logger.error('设置默认壁纸失败', error);
      toast.error('设置失败，请重试');
    },
  });

  const moveWallpaper = (id: string, direction: 'up' | 'down') => {
    const idx = wallpapers.findIndex((w: Wallpaper) => w.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === wallpapers.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const target = wallpapers[swapIdx];

    Promise.all([
      updateWallpaper(id, { sortOrder: swapIdx }),
      updateWallpaper(target.id, { sortOrder: idx }),
    ])
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['wallpapers'] });
        queryClient.invalidateQueries({ queryKey: ['publicSettings'] });
      })
      .catch((err: Error) => {
        logger.error('壁纸排序失败', err);
        toast.error('排序失败，请重试');
      });
  };

  const handleAdd = () => {
    if (!newName.trim()) {
      toast.error('请输入壁纸名称');
      return;
    }
    if (!newUrl.trim()) {
      toast.error('请输入图片 URL');
      return;
    }
    createMutation.mutate();
  };

  const isLoading = wallpapersLoading || settingsLoading;
  const currentPreset = getPresetValueFromUrl(settings.wallpaperApiUrl || '');

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 本地壁纸 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          本地壁纸
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">壁纸轮播</p>
              <p className="text-xs text-muted-foreground">
                开启后多张壁纸自动切换
              </p>
            </div>
            <Switch
              checked={settings.wallpaperEnabled}
              onCheckedChange={(checked) => handleToggle('wallpaperEnabled', checked)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              轮播间隔（秒）
            </label>
            <Input
              type="number"
              min={5}
              value={settings.wallpaperInterval}
              onChange={handleIntervalChange}
              onBlur={handleIntervalBlur}
              disabled={!settings.wallpaperEnabled}
              className="w-32"
            />
          </div>

          <Button onClick={() => setAddDialogOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            添加壁纸
          </Button>

          {wallpapers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed border-white/10 rounded-lg">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无壁纸</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {wallpapers.map((wp: Wallpaper, idx: number) => (
                <div
                  key={wp.id}
                  className="relative group rounded-lg overflow-hidden border border-white/10 bg-white/5"
                >
                  <div className="aspect-video bg-cover bg-center" style={{
                    backgroundImage: `url(${wp.downloadUrl || ''})`,
                  }}>
                    {!wp.downloadUrl && (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => moveWallpaper(wp.id, 'up')}
                        disabled={idx === 0}
                        aria-label="上移"
                        className="h-7 w-7 bg-black/40 border-white/20 text-white"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => moveWallpaper(wp.id, 'down')}
                        disabled={idx === wallpapers.length - 1}
                        aria-label="下移"
                        className="h-7 w-7 bg-black/40 border-white/20 text-white"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="flex justify-between items-center">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setDefaultMutation.mutate(wp.id)}
                        disabled={wp.isDefault}
                        aria-label="设为默认"
                        className={`h-7 w-7 bg-black/40 border-white/20 ${
                          wp.isDefault ? 'text-yellow-400 border-yellow-400/50' : 'text-white'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5" fill={wp.isDefault ? 'currentColor' : 'none'} />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setDeleteId(wp.id)}
                        aria-label="删除"
                        className="h-7 w-7 bg-black/40 border-white/20 text-white hover:bg-destructive hover:border-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {wp.isDefault && (
                    <div className="absolute top-2 left-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                        <Star className="w-3 h-3" fill="currentColor" />
                        默认
                      </span>
                    </div>
                  )}
                  <div className="px-2 py-1.5 bg-black/30">
                    <p className="text-xs text-white/90 truncate">{wp.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* 在线壁纸源 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Globe className="w-4 h-4" />
          在线壁纸源
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">启用在线壁纸</p>
              <p className="text-xs text-muted-foreground">
                从网络 API 拉取随机壁纸作为背景
              </p>
            </div>
            <Switch
              checked={settings.wallpaperApiEnabled}
              onCheckedChange={(checked) => handleToggle('wallpaperApiEnabled', checked)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">壁纸源预设</label>
            <Select
              value={currentPreset}
              onValueChange={handlePresetChange}
              disabled={!settings.wallpaperApiEnabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择预设源" />
              </SelectTrigger>
              <SelectContent>
                {WALLPAPER_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-4 gap-2">
              {WALLPAPER_PRESETS.filter((p) => p.value !== 'custom').map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => settings.wallpaperApiEnabled && handlePresetChange(preset.value)}
                  disabled={!settings.wallpaperApiEnabled}
                  className={`aspect-video rounded-md overflow-hidden border text-xs transition-all ${
                    currentPreset === preset.value
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-white/10 hover:border-white/30'
                  } ${!settings.wallpaperApiEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  title={preset.label}
                >
                  <div
                    className="w-full h-full bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${preset.url})`,
                    }}
                  >
                    <div className="w-full h-full bg-black/40 flex items-end p-1">
                      <span className="text-white/90 text-[10px] truncate">{preset.label}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">API 地址</label>
            <Input
              value={settings.wallpaperApiUrl}
              onChange={(e) => {
                setLocalSettings((prev) => ({
                  ...prev,
                  wallpaperApiUrl: e.target.value,
                }));
                setCustomUrlInput(e.target.value);
              }}
              onBlur={handleCustomUrlBlur}
              disabled={!settings.wallpaperApiEnabled}
              placeholder="https://example.com/api/wallpaper"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">每次打开页面刷新</p>
              <p className="text-xs text-muted-foreground">
                每次加载页面时拉取新壁纸
              </p>
            </div>
            <Switch
              checked={settings.wallpaperApiRefreshOnLoad}
              onCheckedChange={(checked) =>
                handleToggle('wallpaperApiRefreshOnLoad', checked)
              }
              disabled={!settings.wallpaperApiEnabled}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleRefreshNow}
              disabled={!settings.wallpaperApiEnabled || apiRefreshing}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${apiRefreshing ? 'animate-spin' : ''}`} />
              立即刷新
            </Button>
            {apiStatus === 'success' && (
              <span className="text-xs text-green-400">刷新成功</span>
            )}
            {apiStatus === 'error' && (
              <span className="text-xs text-red-400">接口失败，已回退本地壁纸</span>
            )}
            {apiStatus === 'idle' && settings.wallpaperApiEnabled && (
              <span className="text-xs text-muted-foreground">
                当前源：{WALLPAPER_PRESETS.find((p) => p.value === currentPreset)?.label || '自定义'}
              </span>
            )}
          </div>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* 壁纸显示效果 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Palette className="w-4 h-4" />
          显示效果
        </h3>
        <div className="space-y-3">
          <div className="glass-card rounded-lg p-3 bg-black/20">
            <Monitor className="w-6 h-6 text-primary/70 mb-2" />
            <p className="text-xs text-muted-foreground">
              壁纸以全屏 cover 模式展示，叠加暗色渐变遮罩保证文字可读性。
              在线壁纸加载失败时自动回退到本地壁纸。
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            已上传 {wallpapers.length} 张本地壁纸 · 
            在线模式：{settings.wallpaperApiEnabled ? '已开启' : '未开启'}
          </p>
        </div>
      </div>

      {/* 添加壁纸弹窗 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="bg-[hsl(220_25%_12%_/_0.95)] backdrop-blur-2xl border-white/10">
          <DialogHeader>
            <DialogTitle className="font-display">添加壁纸</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-foreground">壁纸名称</label>
              <Input
                placeholder="输入壁纸名称"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-foreground">图片 URL</label>
              <Input
                placeholder="https://example.com/wallpaper.jpg"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                支持直接输入图片链接作为壁纸
              </p>
            </div>
            {newUrl && (
              <div className="aspect-video rounded-md overflow-hidden border border-white/10">
                <Image
                  src={newUrl}
                  alt="预览"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
            >
              取消
            </Button>
            <Button onClick={handleAdd} disabled={createMutation.isPending}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-[hsl(220_25%_12%_/_0.95)] backdrop-blur-2xl border-white/10">
          <AlertDialogTitle>确认删除壁纸？</AlertDialogTitle>
          <AlertDialogDescription>
            删除后无法恢复，确定要删除这张壁纸吗？
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
