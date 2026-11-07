import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import type { WeatherResponse, WeatherTestResponse } from '@shared/api.interface';
import { type WeatherProvider, type WeatherProviderOptions } from './providers/base.provider';
import { WttrProvider } from './providers/wttr.provider';
import { QWeatherProvider } from './providers/qweather.provider';
import { AmapProvider } from './providers/amap.provider';
import { SeniverseProvider } from './providers/seniverse.provider';
import { CustomProvider } from './providers/custom.provider';

type ProviderName = 'wttr' | 'qweather' | 'amap' | 'seniverse' | 'custom';

const WEATHER_PROVIDER_NAMES: readonly ProviderName[] = [
  'wttr',
  'qweather',
  'amap',
  'seniverse',
  'custom',
];

function isProviderName(v: string): v is ProviderName {
  return (WEATHER_PROVIDER_NAMES as readonly string[]).includes(v);
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly providers: Map<string, WeatherProvider>;

  constructor(private readonly httpService: HttpService) {
    this.providers = new Map();
    this.providers.set('wttr', new WttrProvider(this.httpService));
    this.providers.set('qweather', new QWeatherProvider(this.httpService));
    this.providers.set('amap', new AmapProvider(this.httpService));
    this.providers.set('seniverse', new SeniverseProvider(this.httpService));
    this.providers.set('custom', new CustomProvider(this.httpService));
  }

  private getProvider(name: string): WeatherProvider | undefined {
    return this.providers.get(name);
  }

  async getWeather(opts: {
    location?: string;
    unit: 'c' | 'f';
    provider?: string;
    apiKey?: string;
    apiHost?: string;
    customUrl?: string;
    customMapping?: string;
    lat?: number;
    lon?: number;
    adcode?: string;
  }): Promise<WeatherResponse> {
    const providerName = opts.provider && isProviderName(opts.provider)
      ? opts.provider
      : 'wttr';

    const providerOpts: WeatherProviderOptions = {
      location: opts.location,
      lat: opts.lat,
      lon: opts.lon,
      adcode: opts.adcode,
      unit: opts.unit,
      apiKey: opts.apiKey,
      apiHost: opts.apiHost,
      customUrl: opts.customUrl,
      customMapping: opts.customMapping,
    };

    const mainProvider = this.getProvider(providerName);
    if (!mainProvider) {
      return { ok: false, message: `未知的天气数据源: ${providerName}` };
    }

    const mainResult = await mainProvider.getWeather(providerOpts);
    if (mainResult.ok && mainResult.data) {
      return { ok: true, data: mainResult.data };
    }

    // 主 provider 失败，且不是 wttr，降级到 wttr
    if (providerName !== 'wttr') {
      const fallbackReason = mainResult.message || `${providerName} 数据源失败`;
      this.logger.warn(`${providerName} 失败，降级到 wttr.in: ${fallbackReason}`);

      const wttrProvider = this.getProvider('wttr');
      if (wttrProvider) {
        const wttrOpts: WeatherProviderOptions = {
          location: opts.location,
          lat: opts.lat,
          lon: opts.lon,
          adcode: opts.adcode,
          unit: opts.unit,
        };
        const wttrResult = await wttrProvider.getWeather(wttrOpts);
        if (wttrResult.ok && wttrResult.data) {
          return {
            ok: true,
            data: wttrResult.data,
            fallback: true,
            fallbackReason,
          };
        }
      }
      return {
        ok: false,
        message: `主数据源和 wttr.in 均失败: ${fallbackReason}`,
        fallback: false,
        fallbackReason,
      };
    }

    return {
      ok: false,
      message: mainResult.message || '天气数据获取失败',
    };
  }

  async testConnection(opts: {
    provider: string;
    apiKey?: string;
    apiHost?: string;
    customUrl?: string;
    customMapping?: string;
    location?: string;
    adcode?: string;
    lat?: number;
    lon?: number;
    unit?: 'c' | 'f';
  }): Promise<WeatherTestResponse> {
    if (!isProviderName(opts.provider)) {
      return { ok: false, message: `未知的天气数据源: ${opts.provider}` };
    }

    const provider = this.getProvider(opts.provider);
    if (!provider) {
      return { ok: false, message: `未知的天气数据源: ${opts.provider}` };
    }

    const providerOpts: WeatherProviderOptions = {
      location: opts.location,
      lat: opts.lat,
      lon: opts.lon,
      adcode: opts.adcode,
      unit: opts.unit ?? 'c',
      apiKey: opts.apiKey,
      apiHost: opts.apiHost,
      customUrl: opts.customUrl,
      customMapping: opts.customMapping,
    };

    const result = await provider.getWeather(providerOpts);
    if (result.ok && result.data) {
      return {
        ok: true,
        message: '连接成功',
        sampleData: result.data,
      };
    }
    return {
      ok: false,
      message: result.message || '连接失败',
    };
  }
}
