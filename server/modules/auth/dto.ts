import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import type {
  LoginRequest,
  RegisterRequest,
} from '@shared/api.interface';

export class RegisterDto implements RegisterRequest {
  @IsString()
  @Length(3, 50)
  username!: string;

  @IsString()
  @Length(4, 100)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;
}

export class LoginDto implements LoginRequest {
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @IsIn(['admin', 'user'])
  role?: 'admin' | 'user';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;
}
