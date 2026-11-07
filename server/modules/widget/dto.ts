import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsIn,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  CreateWidgetRequest,
  UpdateWidgetRequest,
  BatchUpdateLayoutRequest,
  ResetLayoutRequest,
  WidgetType,
} from '@shared/api.interface';

const WIDGET_TYPES: WidgetType[] = ['clock', 'date', 'weather', 'search', 'nav_card', 'group_title'];

export class CreateWidgetDto implements CreateWidgetRequest {
  @IsString()
  @IsIn(WIDGET_TYPES)
  widgetType!: 'clock' | 'date' | 'weather' | 'search' | 'nav_card' | 'group_title';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  gridCol!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  gridRow!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeW!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeH!: number;
}

export class UpdateWidgetDto implements UpdateWidgetRequest {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  gridCol?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  gridRow?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeW?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeH?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class BatchWidgetPositionDto {
  @IsString()
  id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  gridCol!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  gridRow!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeW!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeH!: number;
}

export class BatchUpdateLayoutDto implements BatchUpdateLayoutRequest {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchWidgetPositionDto)
  widgets!: BatchWidgetPositionDto[];
}

export class ResetLayoutDto implements ResetLayoutRequest {
  @IsOptional()
  @IsString()
  @IsIn(['default', 'compact', 'dense'])
  template?: 'default' | 'compact' | 'dense';
}
