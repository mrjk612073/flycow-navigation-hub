import type { WeatherData } from '@shared/api.interface';

export interface WeatherProviderResult {
  ok: boolean;
  data?: WeatherData;
  message?: string;
}

export interface WeatherProviderOptions {
  location?: string;
  lat?: number;
  lon?: number;
  adcode?: string;
  unit: 'c' | 'f';
  apiKey?: string;
  apiHost?: string;
  customUrl?: string;
  customMapping?: string;
}

export interface WeatherProvider {
  name: string;
  getWeather(opts: WeatherProviderOptions): Promise<WeatherProviderResult>;
}

export const WEATHER_ICON_MAP: Record<string, string> = {
  '113': 'sun',
  '116': 'cloud-sun',
  '119': 'cloud',
  '122': 'cloud',
  '143': 'cloud-fog',
  '176': 'cloud-rain',
  '179': 'snowflake',
  '182': 'cloud-snow',
  '185': 'cloud-drizzle',
  '200': 'cloud-lightning',
  '227': 'snowflake',
  '230': 'snowflake',
  '248': 'cloud-fog',
  '260': 'cloud-fog',
  '263': 'cloud-drizzle',
  '266': 'cloud-drizzle',
  '281': 'cloud-drizzle',
  '284': 'cloud-drizzle',
  '293': 'cloud-rain',
  '296': 'cloud-rain',
  '299': 'cloud-rain',
  '302': 'cloud-rain',
  '305': 'cloud-rain',
  '308': 'cloud-rain',
  '311': 'cloud-snow',
  '314': 'cloud-snow',
  '317': 'cloud-snow',
  '320': 'cloud-snow',
  '323': 'snowflake',
  '326': 'snowflake',
  '329': 'snowflake',
  '332': 'snowflake',
  '335': 'snowflake',
  '338': 'snowflake',
  '350': 'cloud-hail',
  '353': 'cloud-rain',
  '356': 'cloud-rain',
  '359': 'cloud-rain',
  '362': 'cloud-snow',
  '365': 'cloud-snow',
  '368': 'snowflake',
  '371': 'snowflake',
  '374': 'cloud-hail',
  '377': 'cloud-hail',
  '386': 'cloud-lightning',
  '389': 'cloud-lightning',
  '392': 'cloud-lightning',
  '395': 'cloud-lightning',
};

export function getIconByCode(code: string | number): string {
  const key = String(code);
  return WEATHER_ICON_MAP[key] ?? 'cloud';
}
