import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import { LOCALE } from '../../shared/constants/locale.constant';
import { WEIGHT_UNIT } from '../../shared/units/weight';
import { ROLE } from '../constants/role.constant';

export class RegisterOutput {
  @Expose()
  @ApiProperty()
  id: number;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty({ example: [ROLE.USER] })
  roles: ROLE[];

  @Expose()
  @ApiProperty()
  email: string;

  @Expose()
  @ApiProperty({ example: 'Asia/Tokyo' })
  timezone: string;

  @Expose()
  @ApiProperty({ enum: LOCALE })
  locale: LOCALE;

  @Expose()
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Body weight in kg; null until the user sets it.',
  })
  weightKg: number | null;

  @Expose()
  @ApiProperty({ enum: WEIGHT_UNIT })
  weightUnit: WEIGHT_UNIT;

  @Expose()
  @ApiProperty()
  isAccountDisabled: boolean;

  @Expose()
  @ApiProperty()
  createdAt: string;

  @Expose()
  @ApiProperty()
  updatedAt: string;
}
