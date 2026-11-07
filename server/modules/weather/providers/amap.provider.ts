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

// 高德天气状况 → icon 映射
const AMAP_WEATHER_ICON_MAP: Record<string, string> = {
  晴: 'sun',
  多云: 'cloud-sun',
  少云: 'cloud-sun',
  晴间多云: 'cloud-sun',
  阴: 'cloud',
  阵雨: 'cloud-rain',
  雷阵雨: 'cloud-lightning',
  雷阵雨伴有冰雹: 'cloud-hail',
  雨夹雪: 'cloud-snow',
  小雨: 'cloud-rain',
  中雨: 'cloud-rain',
  大雨: 'cloud-rain',
  暴雨: 'cloud-rain',
  大暴雨: 'cloud-rain',
  特大暴雨: 'cloud-rain',
  阵雪: 'snowflake',
  小雪: 'snowflake',
  中雪: 'snowflake',
  大雪: 'snowflake',
  暴雪: 'snowflake',
  雾: 'cloud-fog',
  冻雨: 'cloud-drizzle',
  沙尘暴: 'cloud-fog',
  小到中雨: 'cloud-rain',
  中到大雨: 'cloud-rain',
  大到暴雨: 'cloud-rain',
  暴雨到大暴雨: 'cloud-rain',
  大暴雨到特大暴雨: 'cloud-rain',
  小到中雪: 'snowflake',
  中到大雪: 'snowflake',
  大到暴雪: 'snowflake',
  浮尘: 'cloud-fog',
  扬沙: 'cloud-fog',
  强沙尘暴: 'cloud-fog',
  霾: 'cloud-fog',
  中度霾: 'cloud-fog',
  重度霾: 'cloud-fog',
  严重霾: 'cloud-fog',
};

function mapIcon(condition: string): string {
  return AMAP_WEATHER_ICON_MAP[condition] ?? 'cloud';
}

// 风级 → km/h 近似转换：风级^1.5 * 3.6
function windLevelToKmh(level: number): number {
  if (Number.isNaN(level) || level < 0) return 0;
  return Math.round(Math.pow(level, 1.5) * 3.6);
}

export class AmapProvider implements WeatherProvider {
  readonly name = 'amap';
  private readonly logger = new Logger(AmapProvider.name);

  constructor(private readonly httpService: HttpService) {}

  async getWeather(opts: {
    location?: string;
    adcode?: string;
    unit: 'c' | 'f';
    apiKey?: string;
  }): Promise<WeatherProviderResult> {
    if (!opts.apiKey) {
      return { ok: false, message: '高德天气 API Key 未配置' };
    }

    // 必须有 adcode 才能精确；没有时用 location
    const city = opts.adcode || opts.location;
    if (!city) {
      return { ok: false, message: '缺少 adcode 或位置参数' };
    }

    const key = opts.apiKey;
    const baseUrl = 'https://restapi.amap.com/v3/weather/weatherInfo';
    const nowUrl = `${baseUrl}?city=${encodeURIComponent(city)}&key=${key}&extensions=base`;
    const allUrl = `${baseUrl}?city=${encodeURIComponent(city)}&key=${key}&extensions=all`;

    const [nowRes, allRes] = await Promise.allSettled([
      firstValueFrom(this.httpService.get(nowUrl, { timeout: 8000 })),
      firstValueFrom(this.httpService.get(allUrl, { timeout: 8000 })),
    ]);

    let lives: Record<string, unknown>[] = [];
    if (nowRes.status === 'fulfilled') {
      const d = nowRes.value.data as {
        status?: string;
        lives?: Record<string, unknown>[];
      };
      if (d.status === '1' && d.lives && d.lives.length > 0) {
        lives = d.lives;
      }
    }

    let forecasts: Record<string, unknown>[] = [];
    if (allRes.status === 'fulfilled') {
      const d = allRes.value.data as {
        status?: string;
        forecasts?: Array<{ casts?: Record<string, unknown>[] }>;
      };
      if (d.status === '1' && d.forecasts && d.forecasts[0]?.casts) {
        forecasts = d.forecasts[0].casts;
      }
    }

    if (lives.length === 0 && forecasts.length === 0) {
      this.logger.warn('高德天气获取失败');
      return { ok: false, message: '高德天气数据获取失败' };
    }

    const isC = opts.unit === 'c';
    const life = lives[0];
    const today = forecasts[0];

    const temperature = life ? Number(life.temperature) : 0;
    const condition = life ? String(life.weather ?? '') : (today ? String(today.dayweather ?? '') : '');
    const windDir = life ? String(life.winddirection ?? '') : '';
    const windPower = life ? Number(life.windpower) : 0;
    const humidity = life ? Number(life.humidity) : 0;
    const cityName = life ? String(life.city ?? '') : (opts.location || city);

    const dayTemp = today ? Number(today.daytemp) : temperature;
    const nightTemp = today ? Number(today.nighttemp) : temperature;
    const tempHighC = Math.max(dayTemp, nightTemp);
    const tempLowC = Math.min(dayTemp, nightTemp);

    const forecast: WeatherForecastDay[] = forecasts.slice(0, 3).map((day) => {
      const dT = Number(day.daytemp);
      const nT = Number(day.nighttemp);
      const high = Math.max(dT, nT);
      const low = Math.min(dT, nT);
      return {
        date: String(day.date ?? ''),
        icon: mapIcon(String(day.dayweather ?? '')),
        condition: String(day.dayweather ?? ''),
        tempHigh: isC ? Math.round(high) : Math.round((high * 9) / 5 + 32),
        tempLow: isC ? Math.round(low) : Math.round((low * 9) / 5 + 32),
        windDir: String(day.daywind ?? ''),
        wind: windLevelToKmh(Number(day.daypower)),
      };
    });

    const weatherData: WeatherData = {
      location: cityName,
      condition,
      conditionCode: condition,
      temperature: isC
        ? Math.round(temperature)
        : Math.round((temperature * 9) / 5 + 32),
      feelsLike: isC
        ? Math.round(temperature)
        : Math.round((temperature * 9) / 5 + 32),
      tempHigh: isC
        ? Math.round(tempHighC)
        : Math.round((tempHighC * 9) / 5 + 32),
      tempLow: isC
        ? Math.round(tempLowC)
        : Math.round((tempLowC * 9) / 5 + 32),
      humidity,
      wind: windLevelToKmh(windPower),
      windDir,
      icon: mapIcon(condition),
      source: '高德天气',
      updatedAt: new Date().toISOString(),
      forecast,
    };

    if (opts.adcode) {
      weatherData.conditionCode = opts.adcode;
    }

    return { ok: true, data: weatherData };
  }
}
