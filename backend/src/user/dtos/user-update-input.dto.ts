import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { LOCALE } from '../../shared/constants/locale.constant';
import { IsIanaTimezone } from '../../shared/time/timezone';
import { WEIGHT_UNIT } from '../../shared/units/weight';

export class UpdateUserInput {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(100)
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @Length(6, 100)
  @IsString()
  password?: string;

  @ApiPropertyOptional({ example: 'Asia/Tokyo' })
  @IsOptional()
  @IsIanaTimezone()
  timezone?: string;

  @ApiPropertyOptional({ enum: LOCALE })
  @IsOptional()
  @IsEnum(LOCALE)
  locale?: LOCALE;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description:
      'Body weight in `weightUnit` from this request, or the saved unit if omitted. Converted to kg and checked (20–400 kg) on the server. Pass null to clear it.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  weight?: number | null;

  @ApiPropertyOptional({ enum: WEIGHT_UNIT })
  @IsOptional()
  @IsEnum(WEIGHT_UNIT)
  weightUnit?: WEIGHT_UNIT;
}
