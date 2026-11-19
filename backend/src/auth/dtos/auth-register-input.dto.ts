import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

import { LOCALE } from '../../shared/constants/locale.constant';
import { IsIanaTimezone } from '../../shared/time/timezone';
import { WEIGHT_UNIT } from '../../shared/units/weight';

export class RegisterInput {
  @ApiProperty()
  @IsNotEmpty()
  @MaxLength(100)
  @IsString()
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  @Length(6, 100)
  @IsString()
  password: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(100)
  email: string;

  @ApiProperty({
    example: 'Asia/Tokyo',
    description:
      'IANA time zone. The app prefills it from the browser (Intl.DateTimeFormat().resolvedOptions().timeZone).',
  })
  @IsIanaTimezone()
  timezone: string;

  @ApiProperty({ enum: LOCALE })
  @IsEnum(LOCALE)
  locale: LOCALE;

  @ApiProperty({
    description: 'The "I am at least 16" checkbox. Must be true.',
  })
  @Equals(true, { message: 'You must confirm you are at least 16' })
  ageConfirmed: boolean;

  @ApiPropertyOptional({ enum: WEIGHT_UNIT, default: WEIGHT_UNIT.KG })
  @IsOptional()
  @IsEnum(WEIGHT_UNIT)
  weightUnit?: WEIGHT_UNIT;

  @ApiPropertyOptional({
    type: Number,
    description:
      'Optional body weight in `weightUnit`. Converted to kg and checked (20–400 kg) on the server.',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  weight?: number;
}
