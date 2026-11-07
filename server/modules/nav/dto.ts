import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  CreateCardRequest,
  CreateGroupRequest,
  ReorderCardsRequest,
  UpdateCardRequest,
  UpdateGroupRequest,
} from '@shared/api.interface';

export class CreateGroupDto implements CreateGroupRequest {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateGroupDto implements UpdateGroupRequest {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateCardDto implements CreateCardRequest {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(1000)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  icon?: string;

  @IsOptional()
  @IsString()
  @IsIn(['emoji', 'image', 'favicon'])
  iconType?: 'emoji' | 'image' | 'favicon';

  @IsOptional()
  @IsString()
  groupId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  intranetUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  extranetUrl?: string;
}

export class UpdateCardDto implements UpdateCardRequest {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  icon?: string;

  @IsOptional()
  @IsString()
  @IsIn(['emoji', 'image', 'favicon'])
  iconType?: 'emoji' | 'image' | 'favicon';

  @IsOptional()
  @IsString()
  groupId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  intranetUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  extranetUrl?: string;
}

export class ReorderItemDto {
  @IsString()
  id!: string;

  @Type(() => Number)
  @IsInt()
  sortOrder!: number;

  @IsOptional()
  @IsString()
  groupId?: string | null;
}

export class ReorderCardsDto implements ReorderCardsRequest {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: { id: string; sortOrder: number; groupId: string | null }[];
}
