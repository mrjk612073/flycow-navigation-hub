import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';
import type {
  WeatherResponse,
  WeatherTestResponse,
  IpLocationResult,
  ReverseGeoResult,
} from '@shared/api.interface';

export async function fetchWeather(
  location?: string,
  unit: 'c' | 'f' = 'c',
  lat?: number,
  lon?: number,
  adcode?: string,
): Promise<WeatherResponse> {
  try {
    const params = new URLSearchParams();
    if (location) params.set('location', location);
    if (adcode) params.set('adcode', adcode);
    if (lat !== undefined && lon !== undefined) {
      params.set('lat', String(lat));
      params.set('lon', String(lon));
    }
    params.set('unit', unit);
    const res = await axiosForBackend.get(
      `/api/weather?${params.toString()}`,
    );
    return res.data;
  } catch (err) {
    logger.warn('天气请求失败', err);
    return { ok: false, message: '天气数据获取失败' };
  }
}

export interface TestConnectionConfig {
  provider: string;
  apiKey?: string;
  apiHost?: string;
  customUrl?: string;
  customMapping?: string;
  location?: string;
  adcode?: string;
  unit?: string;
}

export async function testWeatherConnection(
  config: TestConnectionConfig,
): Promise<WeatherTestResponse> {
  try {
    const res = await axiosForBackend.post('/api/weather/test', config);
    return res.data;
  } catch (err) {
    const error = err as { response?: { data?: { error?: { message?: string } } } };
    const msg = error.response?.data?.error?.message ?? '连接测试失败';
    logger.warn('天气连接测试失败', err);
    return { ok: false, message: msg };
  }
}

export async function getIpLocation(): Promise<IpLocationResult> {
  try {
    const res = await axiosForBackend.get('/api/weather/ip-locate');
    return res.data;
  } catch (err) {
    logger.warn('IP 定位失败', err);
    return { ok: false, message: '网络定位请求失败' };
  }
}

export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<ReverseGeoResult> {
  try {
    const res = await axiosForBackend.get(
      `/api/weather/reverse-geocode?lat=${lat}&lon=${lon}`,
    );
    return res.data;
  } catch (err) {
    logger.warn('逆地理编码失败', err);
    return { ok: false, message: '地址解析请求失败' };
  }
}
