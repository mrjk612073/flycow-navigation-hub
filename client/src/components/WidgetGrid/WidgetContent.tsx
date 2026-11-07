import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ExternalLink,
  MapPin,
  Droplets,
  Wind,
  Thermometer,
  Gauge,
  ChevronDown,
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudRain,
  Snowflake,
  CloudSnow,
  CloudDrizzle,
  CloudLightning,
  CloudHail,
} from 'lucide-react';
import type { Widget, WidgetSize, NavCard as NavCardType } from '@shared/api.interface';
import { getPublicSettings } from '@client/src/api/settings';
import { fetchWeather } from '@client/src/api/weather';
import type { WeatherData, WeatherForecastDay } from '@shared/api.interface';
import { useNetworkEnv } from '@client/src/hooks/useNetworkEnv';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';
import { Image } from '@client/src/components/ui/image';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { getAqiColor } from '@client/src/data/regions';
import { cn } from '@/lib/utils';

export interface WidgetContentProps {
  widget: Widget;
  size: WidgetSize;
}

const WidgetContent = ({ widget, size }: WidgetContentProps) => {
  switch (widget.widgetType) {
    case 'clock':
      return <ClockWidget size={size} />;
    case 'weather':
      return <WeatherWidget size={size} />;
    case 'search':
      return <SearchWidget size={size} />;
    case 'nav_card':
      return <NavCardWidget widget={widget} size={size} />;
    case 'group_title':
      return <GroupTitleWidget widget={widget} />;
    case 'date':
      return <DateWidget size={size} />;
    default:
      return <div className="text-white/40 text-sm">未知类型</div>;
  }
};

// ============ 时钟 Widget ============
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const ClockWidget = ({ size }: { size: WidgetSize }) => {
  const { data } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: getPublicSettings,
    staleTime: 60_000,
  });

  const clock24h = data?.settings?.clock24h ?? true;
  const showSeconds = data?.settings?.showSeconds ?? true;

  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date): string => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    if (!clock24h) {
      hours = hours % 12;
      if (hours === 0) hours = 12;
    }
    const hourStr = hours.toString().padStart(2, '0');
    return showSeconds ? `${hourStr}:${minutes}:${seconds}` : `${hourStr}:${minutes}`;
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const weekday = WEEKDAYS[date.getDay()];
    return `${year}年${month}月${day}日 ${weekday}`;
  };

  const showDate = size !== 'sm';
  const showWeather = size === 'lg' || size === 'xl';

  // 字体大小按尺寸调整
  const timeFontSize = {
    sm: '1.5rem',
    md: 'clamp(2rem, 5vw, 3.5rem)',
    lg: 'clamp(2.5rem, 8vw, 4.5rem)',
    xl: 'clamp(3rem, 10vw, 5rem)',
  }[size];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center select-none">
      <div
        className="font-mono tnum text-white font-semibold tracking-tight"
        style={{
          fontSize: timeFontSize,
          textShadow: '0 2px 20px hsl(0 0% 0% / 0.5)',
          lineHeight: 1.1,
        }}
      >
        {formatTime(now)}
      </div>
      {showDate && (
        <div className={cn(
          'text-white/70',
          size === 'md' ? 'text-xs mt-1' : 'text-sm md:text-base mt-2',
        )}>
          {formatDate(now)}
        </div>
      )}
      {showWeather && <MiniWeather />}
    </div>
  );
};

// ============ 内嵌 Mini 天气（时钟 lg/xl 用） ============
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  'cloud-fog': CloudFog,
  'cloud-rain': CloudRain,
  snowflake: Snowflake,
  'cloud-snow': CloudSnow,
  'cloud-drizzle': CloudDrizzle,
  'cloud-lightning': CloudLightning,
  'cloud-hail': CloudHail,
};

function WeatherIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] || Cloud;
  return <Icon className={className} />;
}

const MiniWeather = () => {
  const { data: settingsData } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: getPublicSettings,
    staleTime: 60_000,
  });

  const weatherEnabled = settingsData?.settings?.weatherEnabled ?? true;
  const weatherLocation = settingsData?.settings?.weatherLocation ?? '';
  const weatherUnit = settingsData?.settings?.weatherUnit ?? 'c';
  const weatherRefreshInterval = settingsData?.settings?.weatherRefreshInterval ?? 30;
  const weatherAdcode = settingsData?.settings?.weatherAdcode ?? '';

  const queryEnabled = weatherEnabled && !!weatherLocation;

  const { data: weatherData } = useQuery({
    queryKey: ['weather', weatherLocation, weatherAdcode, weatherUnit],
    queryFn: () => fetchWeather(weatherLocation || undefined, weatherUnit, undefined, undefined, weatherAdcode || undefined),
    enabled: queryEnabled,
    staleTime: weatherRefreshInterval * 60 * 1000,
    refetchInterval: weatherRefreshInterval * 60 * 1000,
    retry: 1,
    retryDelay: 5000,
  });

  const weather = useMemo<WeatherData | null>(() => {
    if (!weatherData?.ok || !weatherData.data) return null;
    return weatherData.data;
  }, [weatherData]);

  const unitLabel = weatherUnit === 'c' ? '°C' : '°F';

  if (!weatherEnabled) return null;
  if (!weather) return null;

  return (
    <div className="mt-2 flex items-center justify-center gap-2 text-white/70">
      <WeatherIcon name={weather.icon} className="w-4 h-4 text-primary" />
      <span className="font-mono tnum text-sm">
        {Math.round(weather.temperature)}
        <span className="text-xs text-white/50">{unitLabel}</span>
      </span>
      <span className="text-xs text-white/60">{weather.condition}</span>
    </div>
  );
};

// ============ 天气 Widget ============
const WeatherWidget = ({ size }: { size: WidgetSize }) => {
  const { data: settingsData } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: getPublicSettings,
    staleTime: 60_000,
  });

  const weatherEnabled = settingsData?.settings?.weatherEnabled ?? true;
  const weatherLocation = settingsData?.settings?.weatherLocation ?? '';
  const weatherUnit = settingsData?.settings?.weatherUnit ?? 'c';
  const weatherRefreshInterval = settingsData?.settings?.weatherRefreshInterval ?? 30;
  const weatherAdcode = settingsData?.settings?.weatherAdcode ?? '';
  const weatherLocationName = settingsData?.settings?.weatherLocationName ?? '';
  const weatherProvider = settingsData?.settings?.weatherProvider ?? 'wttr';

  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLon, setGeoLon] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');
  const [expanded, setExpanded] = useState(false);

  const hasManualLocation = !!(weatherLocation || weatherAdcode);

  useEffect(() => {
    if (!weatherEnabled) return;
    if (hasManualLocation) return;
    if (!navigator.geolocation) { setGeoStatus('failed'); return; }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeoLat(pos.coords.latitude); setGeoLon(pos.coords.longitude); setGeoStatus('success'); },
      () => setGeoStatus('failed'),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  }, [weatherEnabled, hasManualLocation]);

  const queryEnabled = weatherEnabled && (hasManualLocation || geoStatus === 'success');

  const { data: weatherData, isLoading } = useQuery({
    queryKey: ['weather', weatherLocation, geoLat, geoLon, weatherAdcode, weatherUnit, weatherProvider],
    queryFn: () => fetchWeather(
      weatherLocation || undefined,
      weatherUnit,
      geoLat ?? undefined,
      geoLon ?? undefined,
      weatherAdcode || undefined,
    ),
    enabled: queryEnabled,
    staleTime: weatherRefreshInterval * 60 * 1000,
    refetchInterval: weatherRefreshInterval * 60 * 1000,
    retry: 1,
    retryDelay: 5000,
  });

  const weather = useMemo<WeatherData | null>(() => {
    if (!weatherData?.ok || !weatherData.data) return null;
    return weatherData.data;
  }, [weatherData]);

  const forecast = useMemo<WeatherForecastDay[]>(() => weather?.forecast?.slice(0, 3) ?? [], [weather]);

  const locationDisplay = useMemo(() => {
    if (weather?.location) return weather.location;
    if (weatherLocationName) return weatherLocationName;
    if (weatherLocation) return weatherLocation;
    return '定位中...';
  }, [weather, weatherLocationName, weatherLocation]);

  const unitLabel = weatherUnit === 'c' ? '°C' : '°F';

  if (!weatherEnabled) {
    return <div className="flex items-center justify-center h-full text-white/30 text-sm">天气未开启</div>;
  }

  if (isLoading && !weatherData) {
    return (
      <div className="flex items-center gap-2 h-full justify-center">
        <Skeleton className="w-5 h-5 rounded-full" />
        <Skeleton className="w-12 h-5 rounded-md" />
      </div>
    );
  }

  if (!weather) {
    return <div className="flex items-center justify-center h-full text-white/40 text-xs">天气获取失败</div>;
  }

  // sm: 只显示温度+图标
  if (size === 'sm') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1">
        <WeatherIcon name={weather.icon} className="w-6 h-6 text-primary" />
        <span className="font-mono tnum text-white/90 text-sm">
          {Math.round(weather.temperature)}°
        </span>
      </div>
    );
  }

  // md: 温度+描述+位置
  if (size === 'md') {
    return (
      <div className="flex items-center justify-center h-full gap-3">
        <WeatherIcon name={weather.icon} className="w-8 h-8 text-primary shrink-0" />
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-medium text-white/90 font-mono tnum">
              {Math.round(weather.temperature)}
              <span className="text-xs text-white/60">{unitLabel}</span>
            </span>
            <span className="text-sm text-white/70">{weather.condition}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-white/50 mt-0.5">
            <MapPin className="w-3 h-3" />
            <span className="truncate max-w-[120px]">{locationDisplay}</span>
          </div>
        </div>
      </div>
    );
  }

  // lg / xl: 完整天气
  return (
    <div className="flex flex-col h-full">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex flex-wrap items-center justify-center gap-x-3 gap-y-1',
          'text-white/80 transition-all',
          'hover:text-white focus:outline-none',
        )}
        aria-expanded={expanded}
      >
        <WeatherIcon name={weather.icon} className="w-7 h-7 text-primary shrink-0" />
        <span className="text-2xl font-medium text-white/90 font-mono tnum">
          {Math.round(weather.temperature)}
          <span className="text-sm text-white/60 ml-0.5">{unitLabel}</span>
        </span>
        <span className="text-sm text-white/70">{weather.condition}</span>
        <div className="flex items-center gap-1 text-xs text-white/50">
          <MapPin className="w-3 h-3" />
          <span>{locationDisplay}</span>
        </div>
        {size === 'xl' && (
          <ChevronDown className={cn('w-3.5 h-3.5 text-white/40 transition-transform', expanded && 'rotate-180')} />
        )}
      </button>

      {size === 'xl' && (
        <>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-white/50">
            <span className="inline-flex items-center gap-1">
              <Thermometer className="w-3 h-3" />
              体感 {Math.round(weather.feelsLike)}°
            </span>
            <span className="inline-flex items-center gap-1">
              <Droplets className="w-3 h-3" />
              {weather.humidity}%
            </span>
            <span className="inline-flex items-center gap-1">
              <Wind className="w-3 h-3" />
              {weather.windDir} {weather.wind}
            </span>
            {weather.aqi !== undefined && weather.aqiLevel && (
              <span className={cn('inline-flex items-center gap-1 font-medium', getAqiColor(weather.aqiLevel))}>
                <Gauge className="w-3 h-3" />
                AQI {weather.aqi}
              </span>
            )}
          </div>

          {expanded && forecast.length > 0 && (
            <div className="flex gap-2 justify-center mt-3">
              {forecast.map((day, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 min-w-[64px]"
                >
                  <span className="text-[10px] text-white/50">{day.date}</span>
                  <WeatherIcon name={day.icon} className="w-4 h-4 text-primary/80" />
                  <span className="text-[11px] text-white/70">{day.condition}</span>
                  <span className="text-[10px] text-white/60 font-mono tnum">
                    {Math.round(day.tempHigh)}° / {Math.round(day.tempLow)}°
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ============ 搜索 Widget ============
const SearchWidget = ({ size }: { size: WidgetSize }) => {
  const { data } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: getPublicSettings,
    staleTime: 60_000,
  });

  const searchEngine = data?.settings?.searchEngine ?? 'baidu';
  const [keyword, setKeyword] = useState('');

  const getPlaceholder = (): string => {
    switch (searchEngine) {
      case 'baidu': return '搜索百度，回车跳转';
      case 'google': return '搜索 Google，回车跳转';
      case 'bing': return '搜索 Bing，回车跳转';
      default: return '搜索，回车跳转';
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = keyword.trim();
    if (!trimmed) return;
    let url = '';
    switch (searchEngine) {
      case 'baidu': url = `https://www.baidu.com/s?wd=${encodeURIComponent(trimmed)}`; break;
      case 'google': url = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`; break;
      case 'bing': url = `https://www.bing.com/search?q=${encodeURIComponent(trimmed)}`; break;
      default: url = `https://www.baidu.com/s?wd=${encodeURIComponent(trimmed)}`;
    }
    window.open(url, '_blank', 'noopener noreferrer');
  };

  // sm: 只有图标+文字
  if (size === 'sm') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1.5 text-white/70">
        <Search className="w-5 h-5 text-primary" />
        <span className="text-xs">搜索</span>
      </div>
    );
  }

  // md: 标准搜索框
  const isLarge = size === 'xl' || size === 'lg';

  return (
    <form onSubmit={handleSubmit} className="relative w-full h-full flex items-center">
      <div className={cn(
        'glass-card flex items-center w-full gap-3 px-4',
        isLarge ? 'h-14' : 'h-12',
      )}>
        <Search className="w-5 h-5 text-white/60 flex-shrink-0" />
        <Input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={getPlaceholder()}
          className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-white placeholder:text-white/40 text-sm h-auto py-0"
        />
        <Button
          type="submit"
          size="sm"
          className="h-8 px-4 bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex-shrink-0"
        >
          搜索
        </Button>
      </div>
    </form>
  );
};

// ============ 导航卡片 Widget ============
const NavCardWidget = ({ widget, size }: { widget: Widget; size: WidgetSize }) => {
  const { data: settingsData } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: getPublicSettings,
    staleTime: 60_000,
  });

  const natEnabled = settingsData?.settings?.natEnabled ?? false;
  const natIntranetPrefix = settingsData?.settings?.natIntranetPrefix ?? '';

  const { env } = useNetworkEnv(natEnabled, natIntranetPrefix);

  const card: Partial<NavCardType> = {
    id: widget.config.cardId as string,
    name: (widget.config.name as string) || '',
    url: (widget.config.url as string) || '',
    icon: (widget.config.icon as string) || null,
    iconType: (widget.config.iconType as 'emoji' | 'image' | 'favicon') || 'emoji',
    intranetUrl: (widget.config.intranetUrl as string) || '',
    extranetUrl: (widget.config.extranetUrl as string) || '',
  };

  const activeUrl = useMemo(() => {
    if (card.intranetUrl && card.extranetUrl) {
      return env === 'intranet' ? card.intranetUrl : card.extranetUrl;
    }
    return card.url;
  }, [card.url, card.intranetUrl, card.extranetUrl, env]);

  const hasDualUrl = !!(card.intranetUrl && card.extranetUrl);

  const renderIcon = (iconSize: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeMap = { sm: 'w-6 h-6', md: 'w-8 h-8', lg: 'w-12 h-12' };
    const sizeClass = sizeMap[iconSize];
    const fontSize = iconSize === 'sm' ? '20px' : iconSize === 'md' ? '32px' : '48px';

    if (card.iconType === 'image' && card.icon) {
      return <Image src={card.icon} alt={card.name || ''} className={`${sizeClass} rounded-md object-cover`} />;
    }

    if (card.iconType === 'favicon' && activeUrl) {
      try {
        const url = new URL(activeUrl);
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
        return <Image src={faviconUrl} alt={card.name || ''} className={`${sizeClass} rounded-md object-cover`} />;
      } catch (e) {
        logger.warn('解析 favicon URL 失败', e);
      }
    }

    return (
      <span className="leading-none block" style={{ fontSize, fontVariantEmoji: 'emoji' }}>
        {card.icon || '🔗'}
      </span>
    );
  };

  // sm: 图标 + 名称
  if (size === 'sm') {
    return (
      <UniversalLink
        to={activeUrl || '#'}
        target={activeUrl ? '_blank' : undefined}
        rel={activeUrl ? 'noopener noreferrer' : undefined}
        className="flex flex-col items-center justify-center gap-2 w-full h-full no-underline group"
        aria-label={card.name}
        title={hasDualUrl ? `${env === 'intranet' ? '内网' : '外网'}：${activeUrl}` : undefined}
      >
        {hasDualUrl && (
          <span className="absolute top-1.5 right-1.5 text-[9px] px-1 py-0.5 rounded bg-white/10 text-white/50 group-hover:text-white/80">
            {env === 'intranet' ? '内' : '外'}
          </span>
        )}
        <div className="flex items-center justify-center">{renderIcon('md')}</div>
        <span className="text-white text-xs text-center leading-tight px-1 line-clamp-2">
          {card.name}
        </span>
      </UniversalLink>
    );
  }

  // md: 图标 + 名称 + 描述/URL
  if (size === 'md') {
    return (
      <UniversalLink
        to={activeUrl || '#'}
        target={activeUrl ? '_blank' : undefined}
        rel={activeUrl ? 'noopener noreferrer' : undefined}
        className="flex items-center gap-3 w-full h-full no-underline group px-2"
        aria-label={card.name}
      >
        {hasDualUrl && (
          <span className="absolute top-1.5 right-1.5 text-[9px] px-1 py-0.5 rounded bg-white/10 text-white/50 group-hover:text-white/80">
            {env === 'intranet' ? '内' : '外'}
          </span>
        )}
        <div className="flex items-center justify-center shrink-0">{renderIcon('md')}</div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium truncate">{card.name}</div>
          <div className="text-white/40 text-xs truncate mt-0.5">
            {activeUrl || ''}
          </div>
        </div>
      </UniversalLink>
    );
  }

  // lg / xl: 大卡片
  return (
    <UniversalLink
      to={activeUrl || '#'}
      target={activeUrl ? '_blank' : undefined}
      rel={activeUrl ? 'noopener noreferrer' : undefined}
      className="flex flex-col items-center justify-center gap-3 w-full h-full no-underline group px-4"
      aria-label={card.name}
    >
      {hasDualUrl && (
        <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 group-hover:text-white/80">
          {env === 'intranet' ? '内网' : '外网'}
        </span>
      )}
      <div className="flex items-center justify-center">{renderIcon('lg')}</div>
      <div className="text-center">
        <div className="text-white text-base font-medium">{card.name}</div>
        {size === 'xl' && (
          <div className="text-white/50 text-xs mt-1 line-clamp-2 max-w-[180px]">
            {widget.config.description as string || activeUrl || ''}
          </div>
        )}
      </div>
      {size === 'xl' && (
        <Button
          size="sm"
          variant="secondary"
          className="mt-1 h-7 !bg-white/10 hover:!bg-white/20 text-white/80"
          onClick={(e) => { e.preventDefault(); }}
        >
          <ExternalLink className="w-3.5 h-3.5 mr-1" />
          打开
        </Button>
      )}
    </UniversalLink>
  );
};

// ============ 分组标题 Widget ============
const GroupTitleWidget = ({ widget }: { widget: Widget }) => {
  return (
    <div className="flex items-center gap-2 h-full">
      <div className="w-1 h-4 rounded-full bg-primary" aria-hidden="true" />
      <h2 className="text-white font-semibold text-sm tracking-wide">
        {widget.title || '未命名分组'}
      </h2>
    </div>
  );
};

// ============ 日期 Widget ============
const DateWidget = ({ size }: { size: WidgetSize }) => {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date): string => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const weekday = WEEKDAYS[date.getDay()];
    return size === 'sm' ? `${month}/${day}` : `${date.getFullYear()}年${month}月${day}日 ${weekday}`;
  };

  return (
    <div className="flex items-center justify-center h-full text-white/70">
      <span className={size === 'sm' ? 'text-sm' : 'text-base'}>{formatDate(now)}</span>
    </div>
  );
};

export default WidgetContent;
