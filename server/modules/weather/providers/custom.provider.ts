import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import _get from 'lodash/get';
import type {
  WeatherData,
  WeatherForecastDay,
} from '@shared/api.interface';
import {
  type WeatherProvider,
  type WeatherProviderResult,
  getIconByCode,
} from './base.provider';

interface CustomMapping {
  temperature?: string;
  condition?: string;
  icon?: string;
  humidity?: string;
  wind?: string;
  windDir?: string;
  tempHigh?: string;
  tempLow?: string;
  feelsLike?: string;
  location?: string;
  updatedAt?: string;
  aqi?: string;
  aqiLevel?: string;
  forecast?: string;
  forecastDate?: string;
  forecastIcon?: string;
  forecastCondition?: string;
  forecastTempHigh?: string;
  forecastTempLow?: string;
}

function toNumber(val: unknown): number {
  if (typeof val === 'number') return Math.round(val);
  if (typeof val === 'string') {
    const n = Number(val);
    return Number.isNaN(n) ? 0 : Math.round(n);
  }
  return 0;
}

function toString(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

export class CustomProvider implements WeatherProvider {
  readonly name = 'custom';
  private readonly logger = new Logger(CustomProvider.name);

  constructor(private readonly httpService: HttpService) {}

  async getWeather(opts: {
    location?: string;
    lat?: number;
    lon?: number;
    adcode?: string;
    unit: 'c' | 'f';
    apiKey?: string;
    customUrl?: string;
    customMapping?: string;
  }): Promise<WeatherProviderResult> {
    if (!opts.customUrl) {
      return { ok: false, message: '自定义 API URL 未配置' };
    }

    let mapping: CustomMapping = {};
    if (opts.customMapping) {
      try {
        mapping = JSON.parse(opts.customMapping) as CustomMapping;
      } catch {
        return { ok: false, message: '自定义字段映射 JSON 解析失败' };
      }
    }

    // URL 占位符替换
    let loc: string;
    if (opts.lat !== undefined && opts.lon !== undefined) {
      loc = `${opts.lat},${opts.lon}`;
    } else if (opts.location) {
      loc = opts.location;
    } else {
      loc = '';
    }

    let url = opts.customUrl
      .replaceAll('{location}', encodeURIComponent(loc))
      .replaceAll('{key}', opts.apiKey ?? '')
      .replaceAll('{unit}', opts.unit)
      .replaceAll('{adcode}', opts.adcode ?? '');

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: 8000 }),
      );
      const data = response.data;

      const tempRaw = mapping.temperature ? _get(data, mapping.temperature) : undefined;
      const conditionRaw = mapping.condition ? _get(data, mapping.condition) : '';
      const iconRaw = mapping.icon ? _get(data, mapping.icon) : '';
      const humidityRaw = mapping.humidity ? _get(data, mapping.humidity) : 0;
      const windRaw = mapping.wind ? _get(data, mapping.wind) : 0;
      const windDirRaw = mapping.windDir ? _get(data, mapping.windDir) : '';
      const tempHighRaw = mapping.tempHigh ? _get(data, mapping.tempHigh) : undefined;
      const tempLowRaw = mapping.tempLow ? _get(data, mapping.tempLow) : undefined;
      const feelsLikeRaw = mapping.feelsLike ? _get(data, mapping.feelsLike) : undefined;
      const locationRaw = mapping.location ? _get(data, mapping.location) : '';
      const aqiRaw = mapping.aqi ? _get(data, mapping.aqi) : undefined;
      const aqiLevelRaw = mapping.aqiLevel ? _get(data, mapping.aqiLevel) : '';
      const updatedAtRaw = mapping.updatedAt ? _get(data, mapping.updatedAt) : '';

      const temperature = toNumber(tempRaw);
      const tempHigh = tempHighRaw !== undefined ? toNumber(tempHighRaw) : temperature;
      const tempLow = tempLowRaw !== undefined ? toNumber(tempLowRaw) : temperature;
      const feelsLike = feelsLikeRaw !== undefined ? toNumber(feelsLikeRaw) : temperature;

      const condition = toString(conditionRaw);
      const iconStr = toString(iconRaw);
      let icon = 'cloud';
      if (iconStr) {
        // 尝试数字 code 用通用映射
        if (/^\d+$/.test(iconStr)) {
          icon = getIconByCode(iconStr);
        } else {
          icon = iconStr;
        }
      }

      // 解析 forecast
      let forecast: WeatherForecastDay[] | undefined;
      if (mapping.forecast) {
        const forecastArr = _get(data, mapping.forecast);
        if (Array.isArray(forecastArr)) {
          forecast = forecastArr.slice(0, 3).map((day: unknown) => {
            const d = mapping.forecastDate ? _get(day, mapping.forecastDate) : '';
            const ic = mapping.forecastIcon ? _get(day, mapping.forecastIcon) : '';
            const cd = mapping.forecastCondition
              ? _get(day, mapping.forecastCondition)
              : '';
            const th = mapping.forecastTempHigh
              ? _get(day, mapping.forecastTempHigh)
              : 0;
            const tl = mapping.forecastTempLow
              ? _get(day, mapping.forecastTempLow)
              : 0;
            let dayIcon = 'cloud';
            const iconCode = toString(ic);
            if (iconCode) {
              if (/^\d+$/.test(iconCode)) {
                dayIcon = getIconByCode(iconCode);
              } else {
                dayIcon = iconCode;
              }
            }
            return {
              date: toString(d),
              icon: dayIcon,
              condition: toString(cd),
              tempHigh: toNumber(th),
              tempLow: toNumber(tl),
            };
          });
        }
      }

      const weatherData: WeatherData = {
        location: toString(locationRaw) || opts.location || loc,
        condition,
        conditionCode: iconStr,
        temperature,
        feelsLike,
        tempHigh,
        tempLow,
        humidity: toNumber(humidityRaw),
        wind: toNumber(windRaw),
        windDir: toString(windDirRaw),
        icon,
        source: '自定义API',
        updatedAt: toString(updatedAtRaw) || new Date().toISOString(),
        forecast,
      };

      if (aqiRaw !== undefined) {
        const aqiVal = toNumber(aqiRaw);
        if (aqiVal > 0) {
          weatherData.aqi = aqiVal;
        }
      }
      if (aqiLevelRaw !== undefined && toString(aqiLevelRaw)) {
        weatherData.aqiLevel = toString(aqiLevelRaw);
      }

      if (opts.lat !== undefined && opts.lon !== undefined) {
        weatherData.latitude = opts.lat;
        weatherData.longitude = opts.lon;
      }

      return { ok: true, data: weatherData };
    } catch (error) {
      this.logger.warn('自定义天气 API 获取失败');
      return { ok: false, message: '自定义天气 API 请求失败' };
    }
  }
}
