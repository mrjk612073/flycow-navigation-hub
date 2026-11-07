import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import type {
  CreateWallpaperRequest,
  UpdateWallpaperRequest,
} from '@shared/api.interface';

export class CreateWallpaperDto implements CreateWallpaperRequest {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  filePath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  downloadUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateWallpaperDto implements UpdateWallpaperRequest {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
