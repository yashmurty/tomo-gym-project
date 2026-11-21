import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { normalizeEmail } from '../../shared/utils/normalize-email';

export class LoginInput {
  @IsNotEmpty()
  @ApiProperty()
  @IsEmail()
  // Trim + lower-case before validating: phone keyboards add both.
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @MaxLength(100)
  email: string;

  @IsNotEmpty()
  @ApiProperty()
  @IsString()
  password: string;
}
