import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { PersonalAccessToken } from '../entities/personal-access-token.entity';

export class CreateAccessTokenInput {
  @ApiProperty({ example: 'Claude Code on my laptop' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

export class AccessTokenOutput {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: 'tomo_pat_Xk3f' })
  tokenPrefix: string;

  @ApiProperty({ type: Date, nullable: true })
  lastUsedAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}

export class CreatedAccessTokenOutput extends AccessTokenOutput {
  @ApiProperty({
    description: 'The token itself. Shown only once; store it now.',
  })
  token: string;
}

export function toAccessTokenOutput(
  pat: PersonalAccessToken,
): AccessTokenOutput {
  return {
    id: pat.id,
    name: pat.name,
    tokenPrefix: pat.tokenPrefix,
    lastUsedAt: pat.lastUsedAt,
    createdAt: pat.createdAt,
  };
}
