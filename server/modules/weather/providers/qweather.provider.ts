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
} from './base.provider';

// 和风天气 icon code → 自定义 icon 名映射
// 参考 https://dev.qweather.com/docs/resource/icons/
const QWEATHER_ICON_MAP: Record<string, string> = {
  // 晴
  '100': 'sun',
  '150': 'sun',
  // 多云
  '101': 'cloud-sun',
  '102': 'cloud-sun',
  '103': 'cloud',
  '151': 'cloud-sun',
  '152': 'cloud-sun',
  '153': 'cloud',
  // 阴
  '104': 'cloud',
  '154': 'cloud',
  // 小雨 / 毛毛雨
  '300': 'cloud-rain',
  '301': 'cloud-rain',
  '302': 'cloud-rain',
  '303': 'cloud-rain',
  '305': 'cloud-rain',
  '309': 'cloud-drizzle',
  '350': 'cloud-rain',
  '351': 'cloud-rain',
  '399': 'cloud-rain',
  // 雷暴 / 强降雨
  '304': 'cloud-lightning',
  '306': 'cloud-lightning',
  '307': 'cloud-lightning',
  '308': 'cloud-lightning',
  '310': 'cloud-lightning',
  '311': 'cloud-lightning',
  '312': 'cloud-lightning',
  '313': 'cloud-lightning',
  '314': 'cloud-lightning',
  '315': 'cloud-lightning',
  '316': 'cloud-lightning',
  '317': 'cloud-lightning',
  '318': 'cloud-lightning',
  // 雪
  '400': 'snowflake',
  '401': 'snowflake',
  '402': 'snowflake',
  '403': 'snowflake',
  '407': 'cloud-snow',
  '408': 'snowflake',
  '409': 'snowflake',
  '410': 'snowflake',
  '456': 'snowflake',
  '457': 'snowflake',
  '499': 'snowflake',
  // 冰雹 / 雨夹雪
  '404': 'cloud-hail',
  '405': 'cloud-hail',
  '406': 'cloud-hail',
  // 雾 / 霾 / 沙尘
  '500': 'cloud-fog',
  '501': 'cloud-fog',
  '502': 'cloud-fog',
  '503': 'cloud-fog',
  '504': 'cloud-fog',
  '507': 'cloud-fog',
  '508': 'cloud-fog',
  '509': 'cloud-fog',
  '510': 'cloud-fog',
  '511': 'cloud-fog',
  '512': 'cloud-fog',
  '513': 'cloud-fog',
  '514': 'cloud-fog',
  '515': 'cloud-fog',
};

function mapIcon(code: string): string {
  return QWEATHER_ICON_MAP[code] ?? 'cloud';
}

function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

export class QWeatherProvider implements WeatherProvider {
  readonly name = 'qweather';
  private readonly logger = new Logger(QWeatherProvider.name);

  constructor(private readonly httpService: HttpService) {}

  async getWeather(opts: {
    location?: string;
    lat?: number;
    lon?: number;
    adcode?: string;
    unit: 'c' | 'f';
    apiKey?: string;
    apiHost?: string;
  }): Promise<WeatherProviderResult> {
    if (!opts.apiKey) {
      return { ok: false, message: '和风天气 API Key 未配置' };
    }

    const apiHost = opts.apiHost || 'devapi.qweather.com';

    // location 优先级：经纬度 > adcode > 城市名
    let locationParam: string;
    if (opts.lat !== undefined && opts.lon !== undefined) {
      locationParam = `${opts.lon},${opts.lat}`;
    } else if (opts.adcode) {
      locationParam = opts.adcode;
    } else if (opts.location) {
      locationParam = opts.location;
    } else {
      return { ok: false, message: '缺少位置参数' };
    }

    const key = opts.apiKey;
    const nowUrl = `https://${apiHost}/v7/weather/now?location=${encodeURIComponent(locationParam)}&key=${key}`;
    const dailyUrl = `https://${apiHost}/v7/weather/3d?location=${encodeURIComponent(locationParam)}&key=${key}`;
    const airUrl = `https://${apiHost}/v7/air/now?location=${encodeURIComponent(locationParam)}&key=${key}`;

    const [nowRes, dailyRes, airRes] = await Promise.allSettled([
      firstValueFrom(this.httpService.get(nowUrl, { timeout: 8000 })),
      firstValueFrom(this.httpService.get(dailyUrl, { timeout: 8000 })),
      firstValueFrom(this.httpService.get(airUrl, { timeout: 8000 })),
    ]);

    let nowData: Record<string, unknown> | null = null;
    if (nowRes.status === 'fulfilled') {
      const d = nowRes.value.data as { code?: string; now?: Record<string, unknown> };
      if (d.code === '200' && d.now) {
        nowData = d.now;
      }
    }

    let dailyData: Record<string, unknown>[] = [];
    if (dailyRes.status === 'fulfilled') {
      const d = dailyRes.value.data as { code?: string; daily?: Record<string, unknown>[] };
      if (d.code === '200' && d.daily) {
        dailyData = d.daily;
      }
    }

    let airData: Record<string, unknown> | null = null;
    if (airRes.status === 'fulfilled') {
      const d = airRes.value.data as { code?: string; now?: Record<string, unknown> };
      if (d.code === '200' && d.now) {
        airData = d.now;
      }
    }

    if (!nowData && dailyData.length === 0) {
      this.logger.warn('和风天气获取失败');
      return { ok: false, message: '和风天气数据获取失败' };
    }

    const isC = opts.unit === 'c';
    const tempC = nowData ? Number(nowData.temp) : 0;
    const feelsLikeC = nowData ? Number(nowData.feelsLike) : 0;
    const windSpeed = nowData ? Number(nowData.windSpeed) : 0;
    const humidity = nowData ? Number(nowData.humidity) : 0;
    const iconCode = nowData ? String(nowData.icon ?? '') : '';
    const condition = nowData ? String(nowData.text ?? '') : '';
    const windDir = nowData ? String(nowData.windDir ?? '') : '';

    const today = dailyData[0];
    const tempHighC = today ? Number(today.tempMax) : tempC;
    const tempLowC = today ? Number(today.tempMin) : tempC;

    const forecast: WeatherForecastDay[] = dailyData.slice(0, 3).map((day) => ({
      date: String(day.fxDate ?? ''),
      icon: mapIcon(String(day.iconDay ?? '')),
      condition: String(day.textDay ?? ''),
      tempHigh: isC ? Math.round(Number(day.tempMax)) : cToF(Number(day.tempMax)),
      tempLow: isC ? Math.round(Number(day.tempMin)) : cToF(Number(day.tempMin)),
      windDir: String(day.windDirDay ?? ''),
    }));

    const weatherData: WeatherData = {
      location: opts.location || opts.adcode || locationParam,
      condition,
      conditionCode: iconCode,
      temperature: isC ? Math.round(tempC) : cToF(tempC),
      feelsLike: isC ? Math.round(feelsLikeC) : cToF(feelsLikeC),
      tempHigh: isC ? Math.round(tempHighC) : cToF(tempHighC),
      tempLow: isC ? Math.round(tempLowC) : cToF(tempLowC),
      humidity,
      wind: Math.round(windSpeed),
      windDir,
      icon: mapIcon(iconCode),
      source: '和风天气',
      updatedAt: new Date().toISOString(),
      forecast,
    };

    if (airData) {
      const aqiVal = Number(airData.aqi);
      if (!Number.isNaN(aqiVal)) {
        weatherData.aqi = aqiVal;
      }
      weatherData.aqiLevel = String(airData.category ?? '');
    }

    if (opts.lat !== undefined && opts.lon !== undefined) {
      weatherData.latitude = opts.lat;
      weatherData.longitude = opts.lon;
    }

    return { ok: true, data: weatherData };
  }
}
