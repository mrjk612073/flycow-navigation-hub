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

export class WttrProvider implements WeatherProvider {
  readonly name = 'wttr';
  private readonly logger = new Logger(WttrProvider.name);

  constructor(private readonly httpService: HttpService) {}

  async getWeather(opts: {
    location?: string;
    lat?: number;
    lon?: number;
    unit: 'c' | 'f';
  }): Promise<WeatherProviderResult> {
    try {
      let loc: string;
      if (opts.lat !== undefined && opts.lon !== undefined) {
        loc = `${opts.lat},${opts.lon}`;
      } else if (opts.location) {
        loc = opts.location;
      } else {
        loc = '';
      }

      const base = loc
        ? `https://wttr.in/${encodeURIComponent(loc)}`
        : 'https://wttr.in/';
      const url = `${base}?format=j1&lang=zh`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          timeout: 8000,
          headers: {
            'User-Agent': 'curl/8.0',
            Accept: 'application/json',
          },
        }),
      );

      const data = response.data as {
        current_condition?: Array<{
          temp_C?: string;
          temp_F?: string;
          FeelsLikeC?: string;
          FeelsLikeF?: string;
          humidity?: string;
          windspeedKmph?: string;
          winddir16Point?: string;
          weatherCode?: string;
          lang_zh?: Array<{ value?: string }>;
          weatherDesc?: Array<{ value?: string }>;
        }>;
        weather?: Array<{
          date?: string;
          maxtempC?: string;
          maxtempF?: string;
          mintempC?: string;
          mintempF?: string;
          hourly?: Array<{
            weatherCode?: string;
            lang_zh?: Array<{ value?: string }>;
            weatherDesc?: Array<{ value?: string }>;
          }>;
        }>;
        nearest_area?: Array<{
          areaName?: Array<{ value?: string }>;
          latitude?: string;
          longitude?: string;
        }>;
      };

      const current = data.current_condition?.[0];
      const today = data.weather?.[0];
      const nearest = data.nearest_area?.[0];

      if (!current) {
        return { ok: false, message: 'wttr.in 返回数据为空' };
      }

      const isC = opts.unit === 'c';
      const temp = isC ? current.temp_C : current.temp_F;
      const feels = isC ? current.FeelsLikeC : current.FeelsLikeF;
      const maxTemp = isC ? today?.maxtempC : today?.maxtempF;
      const minTemp = isC ? today?.mintempC : today?.mintempF;

      const condition =
        current.lang_zh?.[0]?.value ??
        current.weatherDesc?.[0]?.value ??
        '未知';

      const areaName = nearest?.areaName?.[0]?.value ?? opts.location ?? '当前位置';

      const forecast: WeatherForecastDay[] = (data.weather ?? [])
        .slice(0, 3)
        .map((day) => {
          const midDay = day.hourly?.[4]; // ~noon
          const code = midDay?.weatherCode ?? '';
          const dayCondition =
            midDay?.lang_zh?.[0]?.value ??
            midDay?.weatherDesc?.[0]?.value ??
            '';
          return {
            date: day.date ?? '',
            icon: getIconByCode(code),
            condition: dayCondition,
            tempHigh: Math.round(
              Number(isC ? day.maxtempC : day.maxtempF ?? 0),
            ),
            tempLow: Math.round(
              Number(isC ? day.mintempC : day.mintempF ?? 0),
            ),
          };
        });

      const weatherData: WeatherData = {
        location: areaName,
        condition,
        conditionCode: current.weatherCode ?? '',
        temperature: Math.round(Number(temp ?? 0)),
        feelsLike: Math.round(Number(feels ?? 0)),
        tempHigh: Math.round(Number(maxTemp ?? 0)),
        tempLow: Math.round(Number(minTemp ?? 0)),
        humidity: Number(current.humidity ?? 0),
        wind: Math.round(Number(current.windspeedKmph ?? 0)),
        windDir: current.winddir16Point ?? '',
        icon: getIconByCode(current.weatherCode ?? ''),
        source: 'wttr.in',
        updatedAt: new Date().toISOString(),
        forecast,
        latitude: nearest?.latitude ? Number(nearest.latitude) : undefined,
        longitude: nearest?.longitude ? Number(nearest.longitude) : undefined,
      };

      return { ok: true, data: weatherData };
    } catch (error) {
      this.logger.warn('wttr.in 获取失败');
      return { ok: false, message: 'wttr.in 天气数据获取失败' };
    }
  }
}
