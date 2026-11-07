import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { IpLocationResult, ReverseGeoResult } from '@shared/api.interface';

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(private readonly httpService: HttpService) {}

  async getIpLocation(ip: string): Promise<IpLocationResult> {
    try {
      const queryIp = ip && ip !== '::1' && ip !== '127.0.0.1' && ip !== '::ffff:127.0.0.1'
        ? ip
        : '';
      const url = `http://ip-api.com/json/${queryIp}?lang=zh-CN&fields=status,message,country,regionName,city,district,lat,lon,isp,query`;
      const res = await firstValueFrom(
        this.httpService.get(url, { timeout: 5000 }),
      );
      const data = res.data as {
        status: string;
        message?: string;
        country?: string;
        regionName?: string;
        city?: string;
        district?: string;
        lat?: number;
        lon?: number;
        isp?: string;
      };

      if (data.status !== 'success') {
        return {
          ok: false,
          message: data.message || 'IP 定位失败',
        };
      }

      return {
        ok: true,
        country: data.country,
        province: data.regionName,
        city: data.city,
        district: data.district || undefined,
        latitude: data.lat,
        longitude: data.lon,
        isp: data.isp,
      };
    } catch (err) {
      this.logger.warn('IP 定位请求失败', err);
      return {
        ok: false,
        message: '网络错误，IP 定位不可用',
      };
    }
  }

  async reverseGeocode(
    lat: number,
    lon: number,
    options?: { amapKey?: string },
  ): Promise<ReverseGeoResult> {
    if (options?.amapKey) {
      try {
        const url = `https://restapi.amap.com/v3/geocode/regeo?key=${options.amapKey}&location=${lon},${lat}&extensions=base`;
        const res = await firstValueFrom(
          this.httpService.get(url, { timeout: 5000 }),
        );
        const data = res.data as {
          status?: string;
          regeocode?: {
            addressComponent?: {
              province?: string;
              city?: string;
              district?: string;
              adcode?: string;
            };
          };
        };
        if (data.status === '1' && data.regeocode?.addressComponent) {
          const addr = data.regeocode.addressComponent;
          const province = addr.province || '';
          const city = Array.isArray(addr.city) ? '' : addr.city || '';
          const district = addr.district || '';
          const fullName = [province, city, district].filter(Boolean).join(' ');
          return {
            ok: true,
            province,
            city,
            district,
            adcode: addr.adcode,
            fullName,
          };
        }
      } catch (err) {
        this.logger.warn('高德逆地理编码失败', err);
      }
    }

    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`;
      const res = await firstValueFrom(
        this.httpService.get(url, { timeout: 8000 }),
      );
      const data = res.data as {
        principalSubdivision?: string;
        city?: string;
        locality?: string;
        countryName?: string;
      };
      const province = data.principalSubdivision || '';
      const city = data.city || '';
      const district = data.locality || '';
      const fullName = [province, city, district].filter(Boolean).join(' ');
      if (fullName) {
        return {
          ok: true,
          province,
          city,
          district,
          fullName,
        };
      }
      return {
        ok: false,
        message: '无法解析位置信息',
      };
    } catch (err) {
      this.logger.warn('逆地理编码失败', err);
      return {
        ok: false,
        message: '网络错误，逆地理编码不可用',
      };
    }
  }
}
