import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
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
  MapPin,
  Droplets,
  Wind,
  Thermometer,
  ChevronDown,
  Gauge,
} from 'lucide-react';
import { fetchWeather } from '@client/src/api/weather';
import { getPublicSettings } from '@client/src/api/settings';
import type { WeatherData, WeatherForecastDay } from '@shared/api.interface';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { getAqiColor } from '@client/src/data/regions';
import { cn } from '@/lib/utils';

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

type GeoStatus = 'idle' | 'loading' | 'success' | 'failed';

const WeatherDisplay = () => {
  const { data: settingsData } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: getPublicSettings,
    staleTime: 60_000,
  });

  const weatherEnabled = settingsData?.settings?.weatherEnabled ?? true;
  const weatherLocation = settingsData?.settings?.weatherLocation ?? '';
  const weatherUnit = settingsData?.settings?.weatherUnit ?? 'c';
  const weatherRefreshInterval =
    settingsData?.settings?.weatherRefreshInterval ?? 30;
  const weatherAdcode = settingsData?.settings?.weatherAdcode ?? '';
  const weatherLocationName =
    settingsData?.settings?.weatherLocationName ?? '';
  const weatherProvider = settingsData?.settings?.weatherProvider ?? 'wttr';

  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLon, setGeoLon] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [expanded, setExpanded] = useState(false);

  const hasManualLocation = !!(weatherLocation || weatherAdcode);

  useEffect(() => {
    if (!weatherEnabled) return;
    if (hasManualLocation) return;
    if (!navigator.geolocation) {
      setGeoStatus('failed');
      return;
    }

    setGeoStatus('loading');

    const handleSuccess = (pos: GeolocationPosition) => {
      setGeoLat(pos.coords.latitude);
      setGeoLon(pos.coords.longitude);
      setGeoStatus('success');
    };

    const handleError = () => {
      setGeoStatus('failed');
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      timeout: 8000,
      maximumAge: 10 * 60 * 1000,
    });
  }, [weatherEnabled, hasManualLocation]);

  const queryEnabled =
    weatherEnabled && (hasManualLocation || geoStatus === 'success');

  const { data: weatherData, isLoading } = useQuery({
    queryKey: [
      'weather',
      weatherLocation,
      geoLat,
      geoLon,
      weatherAdcode,
      weatherUnit,
      weatherProvider,
    ],
    queryFn: () =>
      fetchWeather(
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

  const unitLabel = weatherUnit === 'c' ? '°C' : '°F';

  const weather = useMemo<WeatherData | null>(() => {
    if (!weatherData?.ok || !weatherData.data) return null;
    return weatherData.data;
  }, [weatherData]);

  const forecast = useMemo<WeatherForecastDay[]>(() => {
    return weather?.forecast?.slice(0, 3) ?? [];
  }, [weather]);

  const locationDisplay = useMemo(() => {
    if (weather?.location) return weather.location;
    if (weatherLocationName) return weatherLocationName;
    if (weatherLocation) return weatherLocation;
    return '定位中...';
  }, [weather, weatherLocationName, weatherLocation]);

  if (!weatherEnabled) return null;

  const showGeoFailed =
    geoStatus === 'failed' &&
    !hasManualLocation &&
    (!weatherData || !weatherData.ok);

  const showDegrade =
    !isLoading &&
    queryEnabled &&
    (!weatherData || !weatherData.ok) &&
    !showGeoFailed;

  const handleSettingsJump = () => {
    const event = new CustomEvent('settings:open', { detail: { tab: 'weather' } });
    window.dispatchEvent(event);
  };

  return (
    <div
      className="mt-3 flex flex-col items-center justify-center rise"
      style={{ animationDelay: '0.25s' }}
    >
      {isLoading && !weatherData ? (
        <WeatherSkeleton />
      ) : showGeoFailed ? (
        <button
          type="button"
          onClick={handleSettingsJump}
          className="text-xs text-white/50 hover:text-primary transition-colors flex items-center gap-1"
        >
          <MapPin className="w-3 h-3" />
          定位失败，点击设置地点
        </button>
      ) : showDegrade ? (
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <span className="font-mono tnum text-base">--{unitLabel}</span>
          <span className="text-xs">
            {weatherData?.message ?? '天气获取失败'}
          </span>
        </div>
      ) : weather ? (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              'flex flex-wrap items-center justify-center gap-x-3 gap-y-1',
              'text-white/80 transition-all duration-300',
              'hover:scale-[1.02] hover:text-white',
              'focus:outline-none',
              expanded && 'mb-2',
            )}
            aria-expanded={expanded}
            aria-label={expanded ? '收起天气详情' : '展开天气详情'}
          >
            <WeatherIcon
              name={weather.icon}
              className="w-5 h-5 text-primary shrink-0"
            />
            <span className="text-lg font-medium text-white/90 font-mono tnum">
              {Math.round(weather.temperature)}
              <span className="text-sm text-white/60 ml-0.5">{unitLabel}</span>
            </span>
            <span className="text-sm text-white/70">{weather.condition}</span>
            <span className="hidden sm:inline text-xs text-white/40 font-mono tnum">
              {Math.round(weather.tempHigh)}° / {Math.round(weather.tempLow)}°
            </span>
            {weather.feelsLike !== undefined &&
              weather.feelsLike !== null &&
              weather.feelsLike !== weather.temperature && (
                <span className="hidden md:inline-flex items-center gap-1 text-xs text-white/50">
                  <Thermometer className="w-3 h-3" />
                  体感 {Math.round(weather.feelsLike)}°
                </span>
              )}
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-white/50">
              <Droplets className="w-3 h-3" />
              {weather.humidity}%
            </span>
            <span className="hidden md:inline-flex items-center gap-1 text-xs text-white/50">
              <Wind className="w-3 h-3" />
              {weather.windDir} {weather.wind}
            </span>
            {weather.aqi !== undefined && weather.aqiLevel && (
              <span
                className={cn(
                  'hidden lg:inline-flex items-center gap-1 text-xs font-medium',
                  getAqiColor(weather.aqiLevel),
                )}
              >
                <Gauge className="w-3 h-3" />
                AQI {weather.aqi} {weather.aqiLevel}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-white/50">
              <MapPin className="w-3 h-3" />
              {locationDisplay}
            </span>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-white/40 transition-transform duration-300',
                expanded && 'rotate-180',
              )}
            />
          </button>

          {/* 展开区域 */}
          <div
            className={cn(
              'overflow-hidden transition-all duration-300 ease-out w-full',
              expanded
                ? 'max-h-48 opacity-100'
                : 'max-h-0 opacity-0',
            )}
          >
            {forecast.length > 0 && (
              <div className="flex gap-2 justify-center mt-2 overflow-x-auto pb-1">
                {forecast.map((day, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg bg-white/[0.04] border border-white/10 min-w-[72px]"
                  >
                    <span className="text-[11px] text-white/50">
                      {day.date}
                    </span>
                    <WeatherIcon
                      name={day.icon}
                      className="w-5 h-5 text-primary/80"
                    />
                    <span className="text-xs text-white/70">{day.condition}</span>
                    <span className="text-[11px] text-white/60 font-mono tnum">
                      {Math.round(day.tempHigh)}° / {Math.round(day.tempLow)}°
                    </span>
                  </div>
                ))}
              </div>
            )}
            {weather.source && (
              <p className="text-[11px] text-white/30 text-center mt-2">
                数据来源：{weather.source}
                {weather.updatedAt && ` · 更新于 ${weather.updatedAt}`}
              </p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

function WeatherSkeleton() {
  return (
    <div className="flex items-center gap-3 text-white/80">
      <Skeleton className="w-5 h-5 rounded-full" />
      <Skeleton className="w-12 h-5 rounded-md" />
      <Skeleton className="w-10 h-4 rounded-md hidden sm:block" />
      <Skeleton className="w-16 h-3 rounded-md hidden md:block" />
      <Skeleton className="w-3 h-3 rounded-full" />
      <Skeleton className="w-14 h-3 rounded-md" />
    </div>
  );
}

export default WeatherDisplay;
