import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class VerifyPasswordDto {
  @IsString()
  password!: string;
}

export class UpdateSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  wallpaperInterval?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  wallpaperEnabled?: boolean;

  @IsOptional()
  @IsString()
  searchEngine?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  clock24h?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  showSeconds?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  wallpaperApiEnabled?: boolean;

  @IsOptional()
  @IsString()
  wallpaperApiUrl?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  wallpaperApiRefreshOnLoad?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  natEnabled?: boolean;

  @IsOptional()
  @IsString()
  natIntranetPrefix?: string;

  @IsOptional()
  @IsString()
  natExtranetPrefix?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  weatherEnabled?: boolean;

  @IsOptional()
  @IsString()
  weatherLocation?: string;

  @IsOptional()
  @IsIn(['c', 'f'])
  weatherUnit?: 'c' | 'f';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  weatherRefreshInterval?: number;

  @IsOptional()
  @IsIn(['wttr', 'qweather', 'amap', 'seniverse', 'custom'])
  weatherProvider?: 'wttr' | 'qweather' | 'amap' | 'seniverse' | 'custom';

  @IsOptional()
  @IsString()
  weatherApiKey?: string;

  @IsOptional()
  @IsString()
  weatherApiHost?: string;

  @IsOptional()
  @IsString()
  weatherCustomUrl?: string;

  @IsOptional()
  @IsString()
  weatherCustomMapping?: string;

  @IsOptional()
  @IsString()
  weatherAdcode?: string;

  @IsOptional()
  @IsString()
  weatherLocationName?: string;
}

export class ChangePasswordDto {
  @IsString()
  oldPassword!: string;

  @IsString()
  @MinLength(4)
  newPassword!: string;
}

export class ImportDataDto {
  @IsString()
  @IsIn(['overwrite', 'merge'])
  mode!: 'overwrite' | 'merge';

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
