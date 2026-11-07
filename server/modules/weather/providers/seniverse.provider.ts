import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type {
  WeatherData,
  WeatherForecastDay,
} from '@shared/api.interface';
import {
  type WeatherProvider,
  type WeatherProviderResult,
  getIconByCode,
} from './base.provider';

// 心知天气 icon code → 自定义 icon 名
// 参考 https://www.seniverse.com/doc#weather_code
const SENIVERSE_ICON_MAP: Record<string, string> = {
  '0': 'sun', // 晴
  '1': 'sun', // 晴
  '2': 'cloud-sun', // 晴间多云
  '3': 'cloud-sun', // 晴间多云
  '4': 'cloud', // 多云
  '5': 'cloud', // 晴间多云
  '6': 'cloud', // 多云
  '7': 'cloud', // 阴
  '8': 'cloud-fog', // 浮尘
  '9': 'cloud-fog', // 扬沙
  '10': 'cloud-fog', // 沙尘暴
  '11': 'cloud-fog', // 浮尘
  '12': 'cloud-fog', // 扬沙
  '13': 'cloud-fog', // 沙尘暴
  '14': 'cloud-fog', // 霾
  '15': 'cloud-fog', // 霾
  '16': 'cloud-fog', // 霾
  '17': 'cloud-fog', // 霾
  '18': 'cloud-fog', // 雾
  '19': 'cloud-drizzle', // 阵雨
  '20': 'cloud-rain', // 雷阵雨
  '21': 'cloud-lightning', // 雷阵雨伴有冰雹
  '22': 'cloud-rain', // 小雨
  '23': 'cloud-rain', // 中雨
  '24': 'cloud-rain', // 大雨
  '25': 'cloud-rain', // 暴雨
  '26': 'cloud-rain', // 大暴雨
  '27': 'cloud-rain', // 特大暴雨
  '28': 'cloud-rain', // 冻雨
  '29': 'cloud-snow', // 雨夹雪
  '30': 'cloud-snow', // 雨夹雪
  '31': 'snowflake', // 阵雪
  '32': 'snowflake', // 小雪
  '33': 'snowflake', // 中雪
  '34': 'snowflake', // 大雪
  '35': 'snowflake', // 暴雪
  '36': 'cloud-snow', // 浮尘
  '37': 'cloud-snow', // 扬沙
  '38': 'cloud-hail', // 沙尘暴
  '99': 'cloud', // 未知
};

function mapIcon(code: string): string {
  return SENIVERSE_ICON_MAP[code] ?? getIconByCode(code);
}

export class SeniverseProvider implements WeatherProvider {
  readonly name = 'seniverse';
  private readonly logger = new Logger(SeniverseProvider.name);

  constructor(private readonly httpService: HttpService) {}

  async getWeather(opts: {
    location?: string;
    lat?: number;
    lon?: number;
    adcode?: string;
    unit: 'c' | 'f';
    apiKey?: string;
  }): Promise<WeatherProviderResult> {
    if (!opts.apiKey) {
      return { ok: false, message: '心知天气 API Key 未配置' };
    }

    let location: string;
    if (opts.lat !== undefined && opts.lon !== undefined) {
      location = `${opts.lat}:${opts.lon}`;
    } else if (opts.adcode) {
      location = opts.adcode;
    } else if (opts.location) {
      location = opts.location;
    } else {
      return { ok: false, message: '缺少位置参数' };
    }

    const key = opts.apiKey;
    const unit = opts.unit;
    const nowUrl = `https://api.seniverse.com/v3/weather/now.json?location=${encodeURIComponent(location)}&key=${key}&language=zh-Hans&unit=${unit}`;
    const dailyUrl = `https://api.seniverse.com/v3/weather/daily.json?location=${encodeURIComponent(location)}&key=${key}&language=zh-Hans&unit=${unit}&start=0&days=3`;

    const [nowRes, dailyRes] = await Promise.allSettled([
      firstValueFrom(this.httpService.get(nowUrl, { timeout: 8000 })),
      firstValueFrom(this.httpService.get(dailyUrl, { timeout: 8000 })),
    ]);

    let nowData: Record<string, unknown> | null = null;
    let locationName = '';
    if (nowRes.status === 'fulfilled') {
      const d = nowRes.value.data as {
        results?: Array<{
          now?: Record<string, unknown>;
          location?: Record<string, unknown>;
        }>;
      };
      const first = d.results?.[0];
      if (first?.now) {
        nowData = first.now;
        locationName = String(first.location?.name ?? '');
      }
    }

    let dailyData: Record<string, unknown>[] = [];
    if (dailyRes.status === 'fulfilled') {
      const d = dailyRes.value.data as {
        results?: Array<{ daily?: Record<string, unknown>[] }>;
      };
      const first = d.results?.[0];
      if (first?.daily) {
        dailyData = first.daily;
      }
    }

    if (!nowData && dailyData.length === 0) {
      this.logger.warn('心知天气获取失败');
      return { ok: false, message: '心知天气数据获取失败' };
    }

    const temperature = nowData ? Math.round(Number(nowData.temperature ?? 0)) : 0;
    const condition = nowData ? String(nowData.text ?? '') : '';
    const code = nowData ? String(nowData.code ?? '') : '';
    const windDir = nowData ? String(nowData.wind_direction ?? '') : '';
    const wind = nowData ? Math.round(Number(nowData.wind_speed ?? 0)) : 0;
    const humidity = nowData ? Number(nowData.humidity ?? 0) : 0;

    const today = dailyData[0];
    const tempHigh = today ? Math.round(Number(today.high ?? temperature)) : temperature;
    const tempLow = today ? Math.round(Number(today.low ?? temperature)) : temperature;

    const forecast: WeatherForecastDay[] = dailyData.slice(0, 3).map((day) => ({
      date: String(day.date ?? ''),
      icon: mapIcon(String(day.code_day ?? '')),
      condition: String(day.text_day ?? ''),
      tempHigh: Math.round(Number(day.high ?? 0)),
      tempLow: Math.round(Number(day.low ?? 0)),
      windDir: String(day.wind_direction ?? ''),
      wind: Math.round(Number(day.wind_speed ?? 0)),
    }));

    const weatherData: WeatherData = {
      location: locationName || opts.location || location,
      condition,
      conditionCode: code,
      temperature,
      feelsLike: temperature,
      tempHigh,
      tempLow,
      humidity,
      wind,
      windDir,
      icon: mapIcon(code),
      source: '心知天气',
      updatedAt: new Date().toISOString(),
      forecast,
    };

    if (opts.lat !== undefined && opts.lon !== undefined) {
      weatherData.latitude = opts.lat;
      weatherData.longitude = opts.lon;
    }

    return { ok: true, data: weatherData };
  }
}
