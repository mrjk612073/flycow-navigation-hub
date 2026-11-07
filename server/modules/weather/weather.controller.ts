import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { WeatherService } from './weather.service';
import { GeoService } from './geo.service';
import { SettingsService } from '../settings/settings.service';
import type {
  WeatherResponse,
  WeatherTestResponse,
  IpLocationResult,
  ReverseGeoResult,
} from '@shared/api.interface';

@Controller('api/weather')
export class WeatherController {
  constructor(
    private readonly weatherService: WeatherService,
    private readonly geoService: GeoService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get('ip-locate')
  async getIpLocation(@Req() req: { ip?: string; headers?: Record<string, string> }): Promise<IpLocationResult> {
    const ip = this.getClientIp(req);
    return this.geoService.getIpLocation(ip);
  }

  @Get('reverse-geocode')
  async reverseGeocode(
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
    @Req() req?: { user?: { userId?: string } },
  ): Promise<ReverseGeoResult> {
    const latNum = lat !== undefined ? Number(lat) : undefined;
    const lonNum = lon !== undefined ? Number(lon) : undefined;
    if (latNum === undefined || isNaN(latNum) || lonNum === undefined || isNaN(lonNum)) {
      return { ok: false, message: '经纬度参数无效' };
    }
    let amapKey: string | undefined;
    try {
      const userId = req?.user?.userId;
      const cfg = this.settingsService.getWeatherConfig(userId);
      if (cfg.weatherProvider === 'amap' && cfg.weatherApiKey) {
        amapKey = cfg.weatherApiKey;
      }
    } catch {
      // 忽略配置读取失败
    }
    return this.geoService.reverseGeocode(latNum, lonNum, { amapKey });
  }

  private getClientIp(req: { ip?: string; headers?: Record<string, string> }): string {
    const headers = req.headers || {};
    const forwarded = headers['x-forwarded-for'] as string | undefined;
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first;
    }
    const realIp = headers['x-real-ip'] as string | undefined;
    if (realIp) return realIp;
    return req.ip || '';
  }

  @Get()
  async getWeather(
    @Query('location') location?: string,
    @Query('unit') unit?: 'c' | 'f',
    @Query('provider') provider?: string,
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
    @Query('adcode') adcode?: string,
    @Req() req?: { user?: { userId?: string } },
  ): Promise<WeatherResponse> {
    // 从设置读取天气配置（含明文 API Key，服务端内部使用）
    let weatherConfig: {
      weatherProvider?: string;
      weatherApiKey?: string;
      weatherApiHost?: string;
      weatherCustomUrl?: string;
      weatherCustomMapping?: string;
      weatherAdcode?: string;
      weatherLocation?: string;
      weatherUnit?: 'c' | 'f';
    } = {};

    try {
      const userId = req?.user?.userId;
      const cfg = this.settingsService.getWeatherConfig(userId);
      weatherConfig = {
        weatherProvider: cfg.weatherProvider,
        weatherApiKey: cfg.weatherApiKey,
        weatherApiHost: cfg.weatherApiHost,
        weatherCustomUrl: cfg.weatherCustomUrl,
        weatherCustomMapping: cfg.weatherCustomMapping,
        weatherAdcode: cfg.weatherAdcode,
        weatherLocation: cfg.weatherLocation,
        weatherUnit: cfg.weatherUnit,
      };
    } catch {
      // 设置读取失败时走默认 wttr
    }

    const finalProvider = provider || weatherConfig.weatherProvider || 'wttr';
    const finalUnit = unit || weatherConfig.weatherUnit || 'c';
    const finalLocation = location || weatherConfig.weatherLocation;
    const finalAdcode = adcode || weatherConfig.weatherAdcode;
    const finalLat = lat !== undefined ? Number(lat) : undefined;
    const finalLon = lon !== undefined ? Number(lon) : undefined;

    return this.weatherService.getWeather({
      location: finalLocation,
      unit: finalUnit,
      provider: finalProvider,
      apiKey: weatherConfig.weatherApiKey,
      apiHost: weatherConfig.weatherApiHost,
      customUrl: weatherConfig.weatherCustomUrl,
      customMapping: weatherConfig.weatherCustomMapping,
      lat: finalLat,
      lon: finalLon,
      adcode: finalAdcode,
    });
  }

  @Post('test')
  async testConnection(
    @Body() body: {
      provider: string;
      apiKey?: string;
      apiHost?: string;
      customUrl?: string;
      customMapping?: string;
      location?: string;
      adcode?: string;
      lat?: string;
      lon?: string;
      unit?: 'c' | 'f';
    },
    @Headers('x-edit-token') xEditToken: string | undefined,
    @Req() req?: { user?: { userId?: string } },
  ): Promise<WeatherTestResponse> {
    const hasAuth = req?.user?.userId || this.settingsService.validateEditToken(xEditToken);
    if (!hasAuth) {
      throw new UnauthorizedException('请先登录或验证编辑密码');
    }
    const lat = body.lat !== undefined ? Number(body.lat) : undefined;
    const lon = body.lon !== undefined ? Number(body.lon) : undefined;
    return this.weatherService.testConnection({
      provider: body.provider,
      apiKey: body.apiKey,
      apiHost: body.apiHost,
      customUrl: body.customUrl,
      customMapping: body.customMapping,
      location: body.location,
      adcode: body.adcode,
      lat,
      lon,
      unit: body.unit,
    });
  }
}
