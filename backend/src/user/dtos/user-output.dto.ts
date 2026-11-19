import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import { ROLE } from '../../auth/constants/role.constant';
import { LOCALE } from '../../shared/constants/locale.constant';
import { WEIGHT_UNIT } from '../../shared/units/weight';

// Full user shape, including email. Only ever returned to the user themself
// or to an admin: email is never visible to other users (constitution rule
// 16). When friend groups land (roadmap Step 12), group members get a
// separate public DTO (id + display name), never this one.
export class UserOutput {
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
