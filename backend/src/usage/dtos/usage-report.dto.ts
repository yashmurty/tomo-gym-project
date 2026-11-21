import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UsageReportQuery {
  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'UTC date, inclusive. Default: 30 days ago.',
  })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description: 'UTC date, inclusive. Default: today.',
  })
  @IsOptional()
  @IsString()
  to?: string;
}

export class UserUsageOutput {
  @ApiProperty() userId: number;
  @ApiProperty() email: string;
  @ApiProperty({ description: 'Chat messages that called the model' })
  turns: number;
  @ApiProperty({ description: 'Model calls' }) calls: number;
  @ApiProperty() inputTokens: number;
  @ApiProperty() outputTokens: number;
  @ApiProperty() cacheReadTokens: number;
  @ApiProperty() cacheWriteTokens: number;
  @ApiProperty({ description: 'Estimated at list prices' }) costUsd: number;
}

export class UsageReportOutput {
  @ApiProperty({ example: '2026-11-01' }) from: string;
  @ApiProperty({ example: '2026-11-30' }) to: string;
  @ApiProperty() totalCostUsd: number;
  @ApiProperty({ type: [UserUsageOutput] }) users: UserUsageOutput[];
}
