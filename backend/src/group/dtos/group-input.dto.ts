import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { GROUP_LIMITS } from '../constants/group.constant';

// Used for create and rename. Trimmed before validation, so a name of only
// spaces is rejected.
export class GroupNameInput {
  @ApiProperty({
    example: 'Morning Lifters',
    maxLength: GROUP_LIMITS.nameLength,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(GROUP_LIMITS.nameLength)
  name: string;
}

export class InviteSettingsInput {
  @ApiProperty({
    description:
      'Off stops the link working; on again brings back the same link.',
  })
  @IsBoolean()
  enabled: boolean;
}
