import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { getPublicSettings } from '@client/src/api/settings';
import { getApiRandomWallpaper } from '@client/src/api/wallpaper';
import type { Wallpaper as WallpaperType } from '@shared/api.interface';
import { Image as UIImage } from '@client/src/components/ui/image';

const WallpaperComponent = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: getPublicSettings,
    staleTime: 60_000,
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [apiImageData, setApiImageData] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  const wallpapers: WallpaperType[] = data?.wallpapers ?? [];
  const interval = data?.settings?.wallpaperInterval ?? 30;
  const enabled = data?.settings?.wallpaperEnabled ?? true;
  const apiEnabled = data?.settings?.wallpaperApiEnabled ?? false;
  const apiRefreshOnLoad = data?.settings?.wallpaperApiRefreshOnLoad ?? true;

  const currentWallpaper = wallpapers[currentIndex];
  const bgUrl = currentWallpaper?.downloadUrl ?? null;

  const fetchApiWallpaper = useCallback(async () => {
    setApiLoading(true);
    try {
      const res = await getApiRandomWallpaper();
      if (res.imageData) {
        setApiImageData(res.imageData);
        setImageLoaded(false);
      } else if (res.fallback) {
        logger.warn('壁纸 API 回退到本地壁纸');
        setApiImageData(null);
      }
    } catch (err) {
      logger.error('获取 API 壁纸失败', err);
      setApiImageData(null);
    } finally {
      setApiLoading(false);
    }
  }, []);

  // 手动刷新壁纸（供外部调用）
  const handleRefresh = useCallback(() => {
    if (apiEnabled) {
      queryClient.invalidateQueries({ queryKey: ['publicSettings'] });
      void fetchApiWallpaper();
    } else {
      setCurrentIndex((prev) => (prev + 1) % Math.max(wallpapers.length, 1));
    }
  }, [apiEnabled, fetchApiWallpaper, queryClient, wallpapers.length]);

  // 暴露刷新方法到 window 供首页按钮调用
  useEffect(() => {
    (window as unknown as { __refreshWallpaper?: () => void }).__refreshWallpaper =
      handleRefresh;
    return () => {
      const w = window as unknown as { __refreshWallpaper?: () => void };
      if (w.__refreshWallpaper === handleRefresh) {
        delete w.__refreshWallpaper;
      }
    };
  }, [handleRefresh]);

  // API 模式：挂载时拉取
  useEffect(() => {
    if (!apiEnabled) {
      setApiImageData(null);
      return;
    }
    if (apiRefreshOnLoad) {
      void fetchApiWallpaper();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiEnabled, apiRefreshOnLoad]);

  // 自动轮播（仅本地壁纸模式）
  useEffect(() => {
    if (!enabled || apiEnabled || wallpapers.length <= 1 || interval <= 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % wallpapers.length);
    }, interval * 1000);

    return () => clearInterval(timer);
  }, [enabled, apiEnabled, wallpapers.length, interval]);

  // 切换时重置加载态
  useEffect(() => {
    setImageLoaded(false);
  }, [currentIndex, apiImageData]);

  // 预加载下一张（本地轮播模式）
  useEffect(() => {
    if (apiEnabled || wallpapers.length <= 1) return;
    const nextIndex = (currentIndex + 1) % wallpapers.length;
    const nextUrl = wallpapers[nextIndex]?.downloadUrl;
    if (!nextUrl) return;
    const img = new Image();
    img.src = nextUrl;
  }, [currentIndex, wallpapers, apiEnabled]);

  if (error) {
    logger.error('壁纸加载失败', error);
  }

  // 决定当前使用的背景图
  const displayImage = apiEnabled && apiImageData ? apiImageData : bgUrl;
  const isApiMode = apiEnabled && !!apiImageData;

  // 无壁纸时显示纯色背景
  if (isLoading || !enabled || (!isApiMode && wallpapers.length === 0)) {
    return (
      <div
        className="wallpaper-bg"
        style={{ backgroundColor: 'hsl(220 30% 8%)' }}
      />
    );
  }

  // API 模式但还没加载完，显示纯色过渡
  if (isApiMode && !imageLoaded && apiLoading) {
    return (
      <div
        className="wallpaper-bg"
        style={{ backgroundColor: 'hsl(220 30% 8%)' }}
      />
    );
  }

  return (
    <>
      <div
        className="wallpaper-bg"
        style={{
          backgroundImage: imageLoaded && displayImage ? `url(${displayImage})` : 'none',
          backgroundColor: 'hsl(220 30% 8%)',
          opacity: imageLoaded && displayImage ? 1 : 0,
          transition: 'opacity 1s ease-in-out',
        }}
      />
      {/* 预加载图片，加载完成后显示 */}
      {displayImage && (
        <UIImage
          src={displayImage}
          alt=""
          onLoad={() => setImageLoaded(true)}
          className="hidden"
        />
      )}
    </>
  );
};

export default WallpaperComponent;
