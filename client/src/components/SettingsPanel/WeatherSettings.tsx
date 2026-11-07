import { useState, useEffect, useCallback } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  Cloud,
  MapPin,
  Thermometer,
  RefreshCw,
  Database,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Navigation,
  AlertTriangle,
  Search,
  Wifi,
  ShieldAlert,
  Info,
  ChevronDown,
} from 'lucide-react';
import { Switch } from '@client/src/components/ui/switch';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  RadioGroup,
  RadioGroupItem,
} from '@client/src/components/ui/radio-group';
import {
  getPublicSettings,
  updateSettings,
} from '@client/src/api/settings';
import {
  testWeatherConnection,
  getIpLocation,
  reverseGeocode,
} from '@client/src/api/weather';
import {
  PROVINCES,
  PROVIDER_LABELS,
  type Region,
} from '@client/src/data/regions';
import type { AppSettings, WeatherData } from '@shared/api.interface';
import { cn } from '@/lib/utils';

type GeoStatus = 'idle' | 'loading' | 'success' | 'failed';

type LocationMode = 'search' | 'browser' | 'ip' | 'manual';

type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown';

interface GeoErrorInfo {
  code: number;
  message: string;
  detail?: string;
}

interface SearchResult {
  code: string;
  name: string;
  fullName: string;
  level: 'province' | 'city';
}

export default function WeatherSettings() {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<Partial<AppSettings>>({});

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['publicSettings'],
    queryFn: getPublicSettings,
  });

  const settings: AppSettings = {
    ...settingsData?.settings,
    ...localSettings,
  } as AppSettings;

  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    sample?: WeatherData;
  } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [locationMode, setLocationMode] = useState<LocationMode>(
    settings.weatherAdcode || settings.weatherLocation ? 'search' : 'search',
  );
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [geoError, setGeoError] = useState<GeoErrorInfo | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [ipLocationResult, setIpLocationResult] = useState<{
    ok: boolean;
    province?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    message?: string;
  } | null>(null);
  const [isSecureContext, setIsSecureContext] = useState(true);
  const [isInIframe, setIsInIframe] = useState(false);

  // 初始同步已保存的省市区选择
  useEffect(() => {
    if (!settingsData) return;
    if (settings.weatherAdcode) {
      const adcode = settings.weatherAdcode;
      const prov = PROVINCES.find((p) => adcode.startsWith(p.code.slice(0, 2)));
      if (prov) {
        setSelectedProvince(prov.code);
        const city = prov.children?.find((c) =>
          adcode.startsWith(c.code.slice(0, 4)),
        );
        if (city) setSelectedCity(city.code);
      }
    }
  }, [settingsData, settings.weatherAdcode]);

  const updateMutation = useMutation({
    mutationFn: (patch: Partial<AppSettings>) => updateSettings(patch),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicSettings'] });
      queryClient.invalidateQueries({ queryKey: ['weather'] });
    },
    onError: (error: Error) => {
      logger.error('更新天气设置失败', error);
    },
  });

  const commitField = useCallback(
    (key: keyof AppSettings, value: unknown) => {
      updateMutation.mutate({ [key]: value } as Partial<AppSettings>);
    },
    [updateMutation],
  );

  const handleToggle = (key: keyof AppSettings, value: boolean) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    commitField(key, value);
  };

  const handleUnitChange = (value: string) => {
    const unit = value as 'c' | 'f';
    setLocalSettings((prev) => ({ ...prev, weatherUnit: unit }));
    commitField('weatherUnit', unit);
  };

  const handleProviderChange = (value: string) => {
    const provider = value as AppSettings['weatherProvider'];
    setLocalSettings((prev) => ({ ...prev, weatherProvider: provider }));
    commitField('weatherProvider', provider);
    setTestResult(null);
  };

  const handleBlur = (key: keyof AppSettings) => {
    if (key in localSettings) {
      commitField(key, (localSettings as Record<string, unknown>)[key]);
    }
  };

  const handleIntervalBlur = () => {
    if (localSettings.weatherRefreshInterval !== undefined) {
      commitField('weatherRefreshInterval', localSettings.weatherRefreshInterval);
    }
  };

  // 位置模式切换
  const handleLocationModeChange = (value: LocationMode) => {
    setLocationMode(value);
    setGeoError(null);
    setGeoStatus('idle');
    if (value === 'browser') {
      requestGeoLocation();
    } else if (value === 'ip') {
      requestIpLocation();
    }
  };

  // 浏览器自动定位（增强版：详细错误分类）
  const requestGeoLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('failed');
      setGeoError({
        code: -1,
        message: '当前浏览器不支持地理定位',
        detail: '请使用现代浏览器（Chrome / Edge / Safari / Firefox）访问',
      });
      return;
    }

    if (!isSecureContext) {
      setGeoStatus('failed');
      setGeoError({
        code: -2,
        message: '浏览器定位要求 HTTPS 环境',
        detail: '当前为非安全环境，浏览器禁止定位。请使用 HTTPS 域名访问，或改用手动搜索城市。',
      });
      return;
    }

    if (isInIframe) {
      setGeoStatus('failed');
      setGeoError({
        code: -3,
        message: '当前在框架中运行，定位被浏览器策略限制',
        detail: '请在新窗口或正式地址中打开本页，或改用手动搜索城市 / 网络粗定位。',
      });
      return;
    }

    setGeoStatus('loading');
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setGeoStatus('success');
        setGeoError(null);
        const result = await reverseGeocode(latitude, longitude);
        if (result.ok && result.fullName) {
          const patch: Partial<AppSettings> = {
            weatherLocation: result.district || result.city || '',
            weatherLocationName: result.fullName,
            weatherAdcode: result.adcode || '',
          };
          setLocalSettings((prev) => ({ ...prev, ...patch }));
          updateMutation.mutate(patch);
        } else {
          const patch: Partial<AppSettings> = {
            weatherLocation: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            weatherLocationName: `经纬度 ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
            weatherAdcode: '',
          };
          setLocalSettings((prev) => ({ ...prev, ...patch }));
          updateMutation.mutate(patch);
        }
      },
      (error) => {
        setGeoStatus('failed');
        let message = '定位失败';
        let detail = '';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = '定位权限被拒绝';
            detail = '请在浏览器地址栏左侧的定位权限设置中，允许本站使用位置信息，然后重试。\nChrome：地址栏 🔒 → 网站设置 → 位置 → 允许\nEdge：地址栏 🔒 → 此网站的权限 → 位置 → 允许\nSafari：顶部菜单 Safari → 设置 → 网站 → 位置服务 → 允许';
            setPermissionState('denied');
            break;
          case error.POSITION_UNAVAILABLE:
            message = '定位不可用';
            detail = '可能原因：系统定位服务已关闭、设备无 GPS 模块、或网络定位信号不佳。请检查系统定位设置，或改用手动搜索城市。';
            break;
          case error.TIMEOUT:
            message = '定位请求超时';
            detail = '获取位置信息耗时过长，请检查网络连接后重试，或改用手动搜索城市。';
            break;
          default:
            message = error.message || '定位失败';
            detail = '未知错误，请稍后重试，或改用手动搜索城市。';
        }
        setGeoError({ code: error.code, message, detail });
      },
      { timeout: 10000, maximumAge: 60_000, enableHighAccuracy: false },
    );
  };

  // IP 粗定位
  const requestIpLocation = async () => {
    setGeoStatus('loading');
    setGeoError(null);
    const result = await getIpLocation();
    if (result.ok && result.city) {
      setGeoStatus('success');
      setIpLocationResult(result);
      const locationName = [result.province, result.city].filter(Boolean).join(' ');
      const patch: Partial<AppSettings> = {
        weatherLocation: result.city,
        weatherLocationName: locationName,
        weatherAdcode: '',
      };
      setLocalSettings((prev) => ({ ...prev, ...patch }));
      updateMutation.mutate(patch);
    } else {
      setGeoStatus('failed');
      setIpLocationResult(result);
      setGeoError({
        code: -4,
        message: '网络定位失败',
        detail: result.message || '无法通过 IP 获取位置信息，请改用浏览器定位或手动搜索城市。',
      });
    }
  };

  // 检测定位权限状态
  const checkPermission = useCallback(async () => {
    if (!navigator.permissions || !navigator.permissions.query) {
      setPermissionState('unsupported');
      return;
    }
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      setPermissionState(result.state as PermissionState);
      result.onchange = () => {
        setPermissionState(result.state as PermissionState);
      };
    } catch {
      setPermissionState('unknown');
    }
  }, []);

  // 环境检测
  useEffect(() => {
    setIsSecureContext(window.isSecureContext);
    setIsInIframe(window.self !== window.top);
    checkPermission();
  }, [checkPermission]);

  // 城市搜索（基于本地 PROVINCES 数据）
  const handleSearchChange = (keyword: string) => {
    setSearchKeyword(keyword);
    if (!keyword.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    const kw = keyword.trim().toLowerCase();
    const results: SearchResult[] = [];
    for (const prov of PROVINCES) {
      if (prov.name.toLowerCase().includes(kw)) {
        results.push({
          code: prov.code,
          name: prov.name,
          fullName: prov.name,
          level: 'province',
        });
      }
      if (prov.children) {
        for (const city of prov.children) {
          if (city.name.toLowerCase().includes(kw)) {
            results.push({
              code: city.code,
              name: city.name,
              fullName: `${prov.name} ${city.name}`,
              level: 'city',
            });
          }
        }
      }
    }
    setSearchResults(results.slice(0, 20));
    setShowSearchDropdown(true);
  };

  // 选中搜索结果
  const handleSelectSearchResult = (result: SearchResult) => {
    setSearchKeyword(result.fullName);
    setShowSearchDropdown(false);
    if (result.level === 'province') {
      const patch: Partial<AppSettings> = {
        weatherLocation: result.name,
        weatherLocationName: result.fullName,
        weatherAdcode: result.code,
      };
      setLocalSettings((prev) => ({ ...prev, ...patch }));
      updateMutation.mutate(patch);
    } else {
      const patch: Partial<AppSettings> = {
        weatherLocation: result.name,
        weatherLocationName: result.fullName,
        weatherAdcode: result.code,
      };
      setLocalSettings((prev) => ({ ...prev, ...patch }));
      updateMutation.mutate(patch);
    }
  };

  // 省选择
  const handleProvinceChange = (value: string) => {
    setSelectedProvince(value);
    setSelectedCity('');
  };

  // 市选择后保存
  const handleCityChange = (value: string) => {
    setSelectedCity(value);
    const prov = PROVINCES.find((p) => p.code === selectedProvince);
    const city = prov?.children?.find((c) => c.code === value);
    if (city) {
      const locationName = `${prov?.name} ${city.name}`;
      const patch: Partial<AppSettings> = {
        weatherLocation: city.name,
        weatherAdcode: city.code,
        weatherLocationName: locationName,
      };
      setLocalSettings((prev) => ({ ...prev, ...patch }));
      updateMutation.mutate(patch);
    }
  };

  // 城市补充输入（可选，区县级别）
  const handleCitySupplementBlur = () => {
    if (localSettings.weatherLocation !== undefined) {
      commitField('weatherLocation', localSettings.weatherLocation);
    }
    if (localSettings.weatherLocationName !== undefined) {
      commitField('weatherLocationName', localSettings.weatherLocationName);
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const result = await testWeatherConnection({
        provider: settings.weatherProvider,
        apiKey: settings.weatherApiKey || undefined,
        apiHost: settings.weatherApiHost || undefined,
        customUrl: settings.weatherCustomUrl || undefined,
        customMapping: settings.weatherCustomMapping || undefined,
        location: settings.weatherLocation || '北京',
        adcode: settings.weatherAdcode || undefined,
        unit: settings.weatherUnit,
      });
      setTestResult({
        ok: result.ok,
        message: result.message,
        sample: result.sampleData,
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message: '测试请求失败，请稍后重试',
      });
    } finally {
      setTestLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">加载中...</div>;
  }

  const currentCities: Region[] =
    PROVINCES.find((p) => p.code === selectedProvince)?.children ?? [];

  const isFallback = settings.weatherFallbackMessage?.length > 0;

  return (
    <div className="space-y-6">
      {/* 分区 1：基础设置 */}
      <Section title="基础设置" icon={<Cloud className="w-4 h-4" />}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">显示天气信息</p>
              <p className="text-xs text-muted-foreground">
                首页时钟区域显示当前天气状况
              </p>
            </div>
            <Switch
              checked={settings.weatherEnabled}
              onCheckedChange={(checked) =>
                handleToggle('weatherEnabled', checked)
              }
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">温度单位</Label>
            <Select
              value={settings.weatherUnit}
              onValueChange={handleUnitChange}
              disabled={!settings.weatherEnabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent portalled={false}>
                <SelectItem value="c">摄氏度（°C）</SelectItem>
                <SelectItem value="f">华氏度（°F）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <RefreshCw className="w-3 h-3" />
              自动刷新间隔（分钟）
            </Label>
            <Input
              type="number"
              min={5}
              value={settings.weatherRefreshInterval}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (isNaN(val) || val < 5) return;
                setLocalSettings((prev) => ({
                  ...prev,
                  weatherRefreshInterval: val,
                }));
              }}
              onBlur={handleIntervalBlur}
              disabled={!settings.weatherEnabled}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              最小 5 分钟，建议 30 分钟以上以减少 API 调用
            </p>
          </div>
        </div>
      </Section>

      {/* 分区 2：天气数据源 */}
      <Section title="天气数据源" icon={<Database className="w-4 h-4" />}>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">选择数据源</Label>
          <Select
            value={settings.weatherProvider}
            onValueChange={handleProviderChange}
            disabled={!settings.weatherEnabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent portalled={false}>
              <SelectItem value="wttr">内置免费源 (wttr.in)</SelectItem>
              <SelectItem value="qweather">和风天气 QWeather</SelectItem>
              <SelectItem value="amap">高德开放平台</SelectItem>
              <SelectItem value="seniverse">心知天气 Seniverse</SelectItem>
              <SelectItem value="custom">自定义 API</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 分区 3：数据源配置（条件渲染） */}
        <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
          {settings.weatherProvider === 'wttr' && (
            <p className="text-xs text-muted-foreground">
              无需配置，免费使用，定位精度一般。当其他数据源不可用时会自动降级到此源。
            </p>
          )}

          {settings.weatherProvider === 'qweather' && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  API Key
                </Label>
                <div className="relative">
                  <Input
                    type={apiKeyVisible ? 'text' : 'password'}
                    value={localSettings.weatherApiKey ?? settings.weatherApiKey}
                    onChange={(e) => {
                      setLocalSettings((prev) => ({
                        ...prev,
                        weatherApiKey: e.target.value,
                      }));
                    }}
                    onBlur={() => handleBlur('weatherApiKey')}
                    placeholder="请输入和风天气 API Key"
                    disabled={!settings.weatherEnabled}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setApiKeyVisible((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    aria-label={apiKeyVisible ? '隐藏密钥' : '显示密钥'}
                  >
                    {apiKeyVisible ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  API Host
                </Label>
                <Input
                  value={localSettings.weatherApiHost ?? settings.weatherApiHost}
                  onChange={(e) => {
                    setLocalSettings((prev) => ({
                      ...prev,
                      weatherApiHost: e.target.value,
                    }));
                  }}
                  onBlur={() => handleBlur('weatherApiHost')}
                  placeholder="devapi.qweather.com"
                  disabled={!settings.weatherEnabled}
                />
                <p className="text-[11px] text-muted-foreground">
                  免费订阅用 devapi.qweather.com，付费版用 geoapi.qweather.com
                </p>
              </div>

              <div className="pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testLoading || !settings.weatherEnabled}
                >
                  {testLoading && (
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  )}
                  测试连接
                </Button>
              </div>
            </>
          )}

          {(settings.weatherProvider === 'amap' ||
            settings.weatherProvider === 'seniverse') && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  API Key
                </Label>
                <div className="relative">
                  <Input
                    type={apiKeyVisible ? 'text' : 'password'}
                    value={localSettings.weatherApiKey ?? settings.weatherApiKey}
                    onChange={(e) => {
                      setLocalSettings((prev) => ({
                        ...prev,
                        weatherApiKey: e.target.value,
                      }));
                    }}
                    onBlur={() => handleBlur('weatherApiKey')}
                    placeholder={
                      settings.weatherProvider === 'amap'
                        ? '请输入高德开放平台 Web 服务 Key'
                        : '请输入心知天气 API Key'
                    }
                    disabled={!settings.weatherEnabled}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setApiKeyVisible((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    aria-label={apiKeyVisible ? '隐藏密钥' : '显示密钥'}
                  >
                    {apiKeyVisible ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testLoading || !settings.weatherEnabled}
                >
                  {testLoading && (
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  )}
                  测试连接
                </Button>
              </div>
            </>
          )}

          {settings.weatherProvider === 'custom' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  API 地址
                </Label>
                <Input
                  value={
                    localSettings.weatherCustomUrl ??
                    settings.weatherCustomUrl
                  }
                  onChange={(e) => {
                    setLocalSettings((prev) => ({
                      ...prev,
                      weatherCustomUrl: e.target.value,
                    }));
                  }}
                  onBlur={() => handleBlur('weatherCustomUrl')}
                  placeholder="https://api.example.com/weather?city={location}&key={key}&unit={unit}"
                  disabled={!settings.weatherEnabled}
                />
                <p className="text-[11px] text-muted-foreground">
                  支持占位符：{'{location}'} {'{key}'} {'{unit}'} {'{adcode}'}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  API Key（可选）
                </Label>
                <Input
                  type={apiKeyVisible ? 'text' : 'password'}
                  value={localSettings.weatherApiKey ?? settings.weatherApiKey}
                  onChange={(e) => {
                    setLocalSettings((prev) => ({
                      ...prev,
                      weatherApiKey: e.target.value,
                    }));
                  }}
                  onBlur={() => handleBlur('weatherApiKey')}
                  placeholder="可选，将替换 URL 中的 {key}"
                  disabled={!settings.weatherEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  字段映射（JSON）
                </Label>
                <Textarea
                  value={
                    localSettings.weatherCustomMapping ??
                    settings.weatherCustomMapping
                  }
                  onChange={(e) => {
                    setLocalSettings((prev) => ({
                      ...prev,
                      weatherCustomMapping: e.target.value,
                    }));
                  }}
                  onBlur={() => handleBlur('weatherCustomMapping')}
                  placeholder={`{\n  "temperature": "data.temp",\n  "condition": "data.text",\n  "icon": "data.icon",\n  "humidity": "data.humidity",\n  "wind": "data.wind_speed",\n  "windDir": "data.wind_dir",\n  "tempHigh": "data.temp_max",\n  "tempLow": "data.temp_min",\n  "feelsLike": "data.feels_like"\n}`}
                  className="font-mono text-xs min-h-[120px]"
                  disabled={!settings.weatherEnabled}
                />
              </div>

              <div className="pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testLoading || !settings.weatherEnabled}
                >
                  {testLoading && (
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  )}
                  测试连接
                </Button>
              </div>
            </div>
          )}

          {/* 测试结果展示 */}
          {testResult && (
            <div
              className={cn(
                'mt-3 p-3 rounded-lg border text-xs',
                testResult.ok
                  ? 'bg-success/10 border-success/30 text-success-foreground'
                  : 'bg-destructive/10 border-destructive/30 text-destructive-foreground',
              )}
            >
              <div className="flex items-start gap-2">
                {testResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    {testResult.ok ? '连接成功' : '连接失败'}
                  </p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {testResult.message}
                  </p>
                  {testResult.sample && (
                    <div className="mt-2 pt-2 border-t border-white/10 text-[11px] space-y-0.5">
                      <p>城市：{testResult.sample.location}</p>
                      <p>
                        温度：{testResult.sample.temperature}° ·{' '}
                        {testResult.sample.condition}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* 分区 4：位置设置 */}
      <Section title="位置设置" icon={<MapPin className="w-4 h-4" />}>
        <div className="space-y-4">
          {/* 当前位置展示 */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">当前位置</p>
              <p className="text-sm text-foreground font-medium truncate">
                {settings.weatherLocationName || '未设置'}
              </p>
            </div>
          </div>

          {/* 方式 1：搜索城市（推荐） */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm text-foreground font-medium">
                搜索城市
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">
                推荐
              </span>
            </div>
            <div className="relative">
              <Input
                value={searchKeyword}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => searchKeyword && setShowSearchDropdown(true)}
                onBlur={() => setTimeout(() => setShowSearchDropdown(false), 150)}
                placeholder="输入省/市名称，如：杭州、莲都、北京"
                disabled={!settings.weatherEnabled}
                className="pl-9"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border border-white/10 bg-[hsl(220_25%_15%_/_0.95)] backdrop-blur-xl shadow-xl">
                  {searchResults.map((result) => (
                    <button
                      key={result.code}
                      type="button"
                      onClick={() => handleSelectSearchResult(result)}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-white/5 transition-colors"
                    >
                      <span className="font-medium">{result.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {result.fullName}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {showSearchDropdown && searchKeyword && searchResults.length === 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 px-3 py-2.5 rounded-lg border border-white/10 bg-[hsl(220_25%_15%_/_0.95)] backdrop-blur-xl shadow-xl">
                  <p className="text-xs text-muted-foreground">
                    未找到匹配的城市，请尝试其他关键词
                  </p>
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground pl-0.5">
              直接输入城市名快速定位，最准确可靠
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 text-[10px] text-muted-foreground bg-white/[0.02]">
                其他方式
              </span>
            </div>
          </div>

          {/* 方式 2：浏览器精确定位 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-3.5 h-3.5 text-foreground/70" />
                <span className="text-sm text-foreground">浏览器精确定位</span>
              </div>
              <PermissionBadge state={permissionState} />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={requestGeoLocation}
                disabled={geoStatus === 'loading' || !settings.weatherEnabled}
                className="flex-1"
              >
                {geoStatus === 'loading' && locationMode === 'browser' && (
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                )}
                获取当前位置
              </Button>
            </div>
            {geoStatus === 'success' && locationMode === 'browser' && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-success/10 border border-success/30 text-success-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium">定位成功</p>
                  <p className="opacity-80 mt-0.5">
                    {settings.weatherLocationName || '已获取位置信息'}
                  </p>
                </div>
              </div>
            )}
            {geoError && locationMode === 'browser' && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive-foreground">
                <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div className="text-xs flex-1">
                  <p className="font-medium">{geoError.message}</p>
                  {geoError.detail && (
                    <p
                      className="opacity-80 mt-1 whitespace-pre-line"
                      style={{ lineHeight: 1.6 }}
                    >
                      {geoError.detail}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 方式 3：网络粗定位 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="w-3.5 h-3.5 text-foreground/70" />
                <span className="text-sm text-foreground">网络粗定位</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  无需授权
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={requestIpLocation}
                disabled={geoStatus === 'loading' || !settings.weatherEnabled}
                className="flex-1"
              >
                {geoStatus === 'loading' && locationMode === 'ip' && (
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                )}
                按 IP 查询大概位置
              </Button>
            </div>
            {geoStatus === 'success' && locationMode === 'ip' && ipLocationResult?.ok && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-success/10 border border-success/30 text-success-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium">
                    {ipLocationResult.province} {ipLocationResult.city}
                  </p>
                  <p className="opacity-80 mt-0.5">
                    网络定位精度有限，仅供参考，建议搜索精确城市
                  </p>
                </div>
              </div>
            )}
            {geoError && locationMode === 'ip' && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive-foreground">
                <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium">{geoError.message}</p>
                  {geoError.detail && (
                    <p className="opacity-80 mt-0.5">{geoError.detail}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 手动省市级联（高级选项） */}
          <details className="group">
            <summary className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors list-none">
              <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
              手动省市级联选择
            </summary>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">省份</Label>
                  <Select
                    value={selectedProvince}
                    onValueChange={handleProvinceChange}
                    disabled={!settings.weatherEnabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择省份" />
                    </SelectTrigger>
                    <SelectContent portalled={false}>
                      {PROVINCES.map((prov) => (
                        <SelectItem key={prov.code} value={prov.code}>
                          {prov.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">城市</Label>
                  <Select
                    value={selectedCity}
                    onValueChange={handleCityChange}
                    disabled={!selectedProvince || !settings.weatherEnabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择城市" />
                    </SelectTrigger>
                    <SelectContent portalled={false}>
                      {currentCities.map((city) => (
                        <SelectItem key={city.code} value={city.code}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  区/县补充（可选）
                </Label>
                <Input
                  value={
                    localSettings.weatherLocation ?? settings.weatherLocation
                  }
                  onChange={(e) => {
                    setLocalSettings((prev) => ({
                      ...prev,
                      weatherLocation: e.target.value,
                    }));
                  }}
                  onBlur={handleCitySupplementBlur}
                  placeholder="如：朝阳区、莲都区（可选）"
                  disabled={!settings.weatherEnabled}
                />
                <p className="text-[11px] text-muted-foreground">
                  已选位置：
                  <span className="text-foreground">
                    {settings.weatherLocationName || '未选择'}
                  </span>
                </p>
              </div>
            </div>
          </details>

          {/* 环境提示 */}
          {!isSecureContext && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/30 text-warning-foreground">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium">非安全环境</p>
                <p className="opacity-80 mt-0.5">
                  当前非 HTTPS 环境，浏览器定位不可用。请用 HTTPS 域名访问，或使用搜索城市 / 网络粗定位。
                </p>
              </div>
            </div>
          )}
          {isInIframe && permissionState === 'denied' && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-info/10 border border-info/30 text-info-foreground">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium">在预览框架中</p>
                <p className="opacity-80 mt-0.5">
                  当前在预览框架内运行，定位可能被浏览器策略限制。请在新窗口打开或使用正式地址访问。
                </p>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* 分区 5：状态与降级 */}
      <Section
        title="状态与降级"
        icon={<Thermometer className="w-4 h-4" />}
      >
        <div className="space-y-2">
          <p className="text-sm text-foreground">
            当前数据源：
            <span className="text-primary">
              {PROVIDER_LABELS[settings.weatherProvider] ??
                settings.weatherProvider}
            </span>
          </p>
          {isFallback && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning-foreground">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">
                  当前数据源不可用，已降级到内置免费源
                </p>
                <p className="text-[11px] opacity-80 mt-1">
                  降级原因：{settings.weatherFallbackMessage}
                </p>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function PermissionBadge({ state }: { state: PermissionState }) {
  const config: Record<PermissionState, { label: string; className: string }> = {
    granted: { label: '已授权', className: 'bg-success/15 text-success' },
    denied: { label: '已拒绝', className: 'bg-destructive/15 text-destructive' },
    prompt: { label: '未授权', className: 'bg-warning/15 text-warning-foreground' },
    unsupported: { label: '不支持', className: 'bg-muted text-muted-foreground' },
    unknown: { label: '检测中', className: 'bg-muted text-muted-foreground' },
  };
  const { label, className } = config[state];
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', className)}>
      {label}
    </span>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-lg p-4 space-y-3 bg-white/[0.02]">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}
