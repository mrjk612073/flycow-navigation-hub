import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, RefreshCw, Wifi, WifiOff, AlertTriangle, X, Edit, Check } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import Wallpaper from './Wallpaper';
import { SettingsPanel } from '@client/src/components/SettingsPanel';
import { WidgetGrid, LayoutToolbar } from '@client/src/components/WidgetGrid';
import { getWidgetLayout, batchUpdateLayout, resetLayout } from '@client/src/api/widget';
import { getEditToken, clearEditToken, getPublicSettings, getAuthToken } from '@client/src/api/settings';
import type { Widget } from '@shared/api.interface';
import { useNetworkEnv, type NetworkEnv } from '@client/src/hooks/useNetworkEnv';
import { Button } from '@client/src/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const HomePage = () => {
  const queryClient = useQueryClient();
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string>('cards');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);

  const isMobile = useIsMobile();

  const { data: widgetLayout, error: widgetError, refetch: refetchWidgetLayout } = useQuery({
    queryKey: ['widgetLayout'],
    queryFn: getWidgetLayout,
    staleTime: 30_000,
  });

  const { data: settingsData, error: settingsError } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: getPublicSettings,
    staleTime: 60_000,
  });

  const backendUnavailable = !!(widgetError && settingsError);
  const [showErrorBanner, setShowErrorBanner] = useState(true);

  const natEnabled = settingsData?.settings?.natEnabled ?? false;
  const natIntranetPrefix = settingsData?.settings?.natIntranetPrefix ?? '';

  const { env, manualOverride, setManualOverride } = useNetworkEnv(
    natEnabled,
    natIntranetPrefix,
  );

  // 下拉刷新相关
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const PULL_THRESHOLD = 80;

  const isTouchDevice =
    typeof window !== 'undefined' && 'ontouchstart' in window;

  useEffect(() => {
    const editToken = getEditToken();
    const authToken = getAuthToken();
    if (editToken || authToken) {
      setIsEditMode(true);
    }
  }, []);

  // 监听设置面板打开事件（从天气组件等跳转）
  useEffect(() => {
    const handleOpenSettings = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab?: string }>;
      if (customEvent.detail?.tab) {
        setSettingsInitialTab(customEvent.detail.tab);
      }
      setSettingsOpen(true);
    };
    window.addEventListener('settings:open', handleOpenSettings);
    return () => {
      window.removeEventListener('settings:open', handleOpenSettings);
    };
  }, []);

  const pendingSaveRef = useRef<Widget[] | null>(null);
  const isSavingRef = useRef(false);

  const flushPendingSave = useCallback(async () => {
    if (isSavingRef.current) return;
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;
    isSavingRef.current = true;

    const payload = pending.map((w) => ({
      id: w.id,
      gridCol: w.gridCol,
      gridRow: w.gridRow,
      sizeW: w.sizeW,
      sizeH: w.sizeH,
    }));

    try {
      await batchUpdateLayout({ widgets: payload });
    } catch (err) {
      logger.error('保存布局失败', err);
      queryClient.invalidateQueries({ queryKey: ['widgetLayout'] });
    } finally {
      isSavingRef.current = false;
      if (pendingSaveRef.current) {
        flushPendingSave();
      }
    }
  }, [queryClient]);

  const handleLayoutChange = useCallback((widgets: Widget[]) => {
    pendingSaveRef.current = widgets;
    flushPendingSave();
  }, [flushPendingSave]);

  const handleResetLayout = useCallback(async () => {
    try {
      await resetLayout();
      queryClient.invalidateQueries({ queryKey: ['widgetLayout'] });
    } catch (err) {
      logger.error('重置布局失败', err);
    }
  }, [queryClient]);

  const handleApplyTemplate = useCallback(async (template: string) => {
    try {
      await resetLayout(template);
      queryClient.invalidateQueries({ queryKey: ['widgetLayout'] });
    } catch (err) {
      logger.error('应用模板失败', err);
    }
  }, [queryClient]);

  const handleEditSuccess = () => {
    setIsEditMode(true);
    refetchWidgetLayout();
  };

  const handleExitEdit = () => {
    clearEditToken();
    setIsEditMode(false);
    setSettingsOpen(false);
    logger.info('已退出编辑模式');
  };

  const handleRefreshWallpaper = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const w = window as unknown as { __refreshWallpaper?: () => void };
    if (w.__refreshWallpaper) {
      w.__refreshWallpaper();
    }
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [isRefreshing]);

  const handleNetworkToggle = (target: 'auto' | NetworkEnv) => {
    if (target === 'auto') {
      setManualOverride(null);
    } else {
      setManualOverride(target);
    }
    setShowNetworkMenu(false);
  };

  // 触摸事件：下拉刷新
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    touchStartY.current = e.touches[0].clientY;
    touchCurrentY.current = e.touches[0].clientY;
    setIsPulling(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    touchCurrentY.current = e.touches[0].clientY;
    const delta = touchCurrentY.current - touchStartY.current;
    if (delta > 0 && window.scrollY <= 0) {
      // 阻尼效果
      const damped = delta * 0.5;
      setPullDistance(Math.min(damped, 160));
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (pullDistance >= PULL_THRESHOLD) {
      handleRefreshWallpaper();
    }
    setPullDistance(0);
  };

  return (
    <div
      className="relative w-full min-h-screen overflow-x-hidden"
      onTouchStart={isTouchDevice ? handleTouchStart : undefined}
      onTouchMove={isTouchDevice ? handleTouchMove : undefined}
      onTouchEnd={isTouchDevice ? handleTouchEnd : undefined}
      style={{
        paddingTop: isMobile ? 'env(safe-area-inset-top)' : undefined,
      }}
    >
      <Wallpaper />

      {backendUnavailable && showErrorBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-2 max-w-6xl mx-auto">
            <div className="flex items-center gap-2 text-white text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>后端服务未连接，当前显示示例数据。请检查服务端运行状态。</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowErrorBanner(false)}
              className="!w-7 !h-7 text-white/80 hover:text-white hover:bg-white/20"
              aria-label="关闭提示"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 下拉刷新提示 */}
      {isTouchDevice && pullDistance > 0 && (
        <div
          className={cn(
            'fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none transition-all',
          )}
          style={{
            height: `${pullDistance}px`,
            paddingTop: isMobile
              ? 'calc(env(safe-area-inset-top) + 4px)'
              : '4px',
          }}
        >
          <div className="text-white/70 text-xs flex items-center gap-2">
            <RefreshCw
              className={cn(
                'w-4 h-4 transition-transform',
                pullDistance >= PULL_THRESHOLD && 'rotate-180',
                isRefreshing && 'animate-spin',
              )}
            />
            {isRefreshing
              ? '刷新中...'
              : pullDistance >= PULL_THRESHOLD
                ? '释放刷新壁纸'
                : '下拉刷新壁纸'}
          </div>
        </div>
      )}

      <div
        className={cn(
          'relative z-10 flex flex-col min-h-screen',
          'px-4 md:px-6 lg:px-12 py-6 md:py-8',
        )}
        style={{
          paddingBottom: isMobile
            ? 'calc(env(safe-area-inset-bottom) + 2rem)'
            : undefined,
        }}
      >
        <div className="flex justify-end items-start gap-2 relative">
          {natEnabled && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNetworkMenu((v) => !v)}
                className="glass-card !w-10 !h-10 text-white/70 hover:text-white"
                aria-label={`当前网络：${env === 'intranet' ? '内网' : '外网'}`}
                title={`${manualOverride ? '手动' : '自动'} - ${env === 'intranet' ? '内网' : '外网'}`}
              >
                {env === 'intranet' ? (
                  <Wifi className="w-4 h-4" />
                ) : (
                  <WifiOff className="w-4 h-4" />
                )}
              </Button>
              <span
                className={cn(
                  'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-[hsl(220_25%_12%)]',
                  env === 'intranet' ? 'bg-green-400' : 'bg-blue-400',
                )}
                aria-hidden="true"
              />
              {showNetworkMenu && (
                <div className="absolute right-0 top-12 z-50 glass-card rounded-lg py-1 min-w-[120px] shadow-xl">
                  <button
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors',
                      !manualOverride && 'text-primary',
                    )}
                    onClick={() => handleNetworkToggle('auto')}
                  >
                    自动检测
                  </button>
                  <button
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors',
                      manualOverride === 'intranet' && 'text-primary',
                    )}
                    onClick={() => handleNetworkToggle('intranet')}
                  >
                    内网模式
                  </button>
                  <button
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors',
                      manualOverride === 'extranet' && 'text-primary',
                    )}
                    onClick={() => handleNetworkToggle('extranet')}
                  >
                    外网模式
                  </button>
                </div>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefreshWallpaper}
            className="glass-card !w-10 !h-10 text-white/70 hover:text-white"
            aria-label="刷新壁纸"
          >
            <RefreshCw
              className={cn('w-5 h-5', isRefreshing && 'animate-spin')}
            />
          </Button>

          {isEditMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExitEdit}
              className="glass-card !h-9 !px-4 text-white/80 hover:text-white border-white/20"
            >
              退出编辑
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            className="glass-card !w-10 !h-10 text-white/70 hover:text-white"
            aria-label="设置"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 mt-8 md:mt-12 pb-8">
          <div className="max-w-6xl mx-auto w-full">
            {/* 编辑模式工具栏 */}
            {isEditMode && (
              <div className="flex justify-center mb-6">
                <LayoutToolbar
                  onReset={handleResetLayout}
                  onApplyTemplate={handleApplyTemplate}
                />
              </div>
            )}

            {!widgetLayout || widgetLayout.widgets.length === 0 ? (
              <div className="text-center text-white/40 py-16">
                加载中...
              </div>
            ) : (
              <WidgetGrid
                widgets={widgetLayout.widgets}
                isEditMode={isEditMode}
                onLayoutChange={handleLayoutChange}
              />
            )}
          </div>
        </div>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        isEditMode={isEditMode}
        onEditSuccess={handleEditSuccess}
        initialTab={settingsInitialTab}
      />
    </div>
  );
};

export default HomePage;
