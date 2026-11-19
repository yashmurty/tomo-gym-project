import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

import { ROLE } from '../../auth/constants/role.constant';
import { LOCALE } from '../../shared/constants/locale.constant';
import { IsIanaTimezone } from '../../shared/time/timezone';
import { WEIGHT_UNIT } from '../../shared/units/weight';

export class CreateUserInput {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(6, 100)
  password: string;

  @ApiProperty()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ROLE, { each: true })
  roles: ROLE[];

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(100)
  email: string;

  @ApiProperty()
  @IsBoolean()
  isAccountDisabled: boolean;

  @ApiProperty({ example: 'Asia/Tokyo' })
  @IsIanaTimezone()
  timezone: string;

  @ApiProperty({ enum: LOCALE })
  @IsEnum(LOCALE)
  locale: LOCALE;

  @ApiPropertyOptional({ enum: WEIGHT_UNIT, default: WEIGHT_UNIT.KG })
  @IsOptional()
  @IsEnum(WEIGHT_UNIT)
  weightUnit?: WEIGHT_UNIT;

  // Already converted and range-checked by the caller (see toBodyWeightKg).
  weightKg?: number | null;

  // Set by the signup flow when the age checkbox is ticked. Not client input.
  ageConfirmedAt?: Date | null;
}
