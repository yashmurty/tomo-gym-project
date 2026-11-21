import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { TURN_STATUS } from '../../chat/entities/chat-message.entity';

export class ChatInput {
  @ApiProperty({ example: '2x10 @ 47kg lat pulldown' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;

  @ApiProperty({
    example: '0f8fad5b-d9cb-469f-a165-70867728950e',
    description:
      'Client-generated, unique per message. Retrying with the same key replays the stored result instead of running the agent again.',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/, {
    message: 'idempotencyKey must be 8–64 characters of A–Z, a–z, 0–9, _ or -',
  })
  idempotencyKey: string;
}

// Server-sent events of one chat turn.
export type ChatEvent =
  | { type: 'turn'; turnId: number; replayed: boolean }
  | { type: 'text'; text: string }
  | {
      type: 'tool';
      name: string;
      ok: boolean;
      result?: unknown;
      error?: string;
    }
  // `changes`: how many changes the turn saved that can still be undone.
  | { type: 'done'; turnId: number; changes: number }
  // `code` is set when a limit stopped the turn (rate_limited, daily_budget,
  // monthly_budget, service_paused). `changes` as on `done`: a turn that
  // stopped halfway keeps what it saved, and it stays undoable.
  | { type: 'error'; message: string; code?: string; changes?: number };

// The part of a turn shown in the chat: replies and tool calls, in order.
export type TurnEvent = Extract<ChatEvent, { type: 'text' | 'tool' }>;

export class ChatHistoryQuery {
  @ApiPropertyOptional({
    description: 'Only turns before this one (the id of the oldest loaded).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  before?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class ChatTurnEventOutput {
  @ApiProperty({ enum: ['text', 'tool'] })
  type: 'text' | 'tool';

  @ApiPropertyOptional({ description: 'On text events: the reply.' })
  text?: string;

  @ApiPropertyOptional({ description: 'On tool events: the tool called.' })
  name?: string;

  @ApiPropertyOptional({ description: 'On tool events: whether it worked.' })
  ok?: boolean;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'On successful tool events: what the tool returned.',
  })
  result?: unknown;

  @ApiPropertyOptional({ description: 'On failed tool events.' })
  error?: string;
}

export class ChatTurnOutput {
  @ApiProperty({ description: 'The turn id (the user message id).' })
  id: number;

  @ApiProperty({ description: 'What the user typed.' })
  text: string;

  @ApiProperty({ enum: TURN_STATUS })
  status: TURN_STATUS;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({
    type: [ChatTurnEventOutput],
    description: 'The same text / tool events the stream sent.',
  })
  events: TurnEvent[];

  @ApiProperty({ description: 'Saved changes that can still be undone.' })
  changes: number;

  @ApiProperty({ description: 'The turn saved changes and all were undone.' })
  undone: boolean;
}

export class ChatHistoryOutput {
  @ApiProperty({ type: [ChatTurnOutput], description: 'Oldest first.' })
  turns: ChatTurnOutput[];

  @ApiProperty({ description: 'Older turns exist before the first one.' })
  hasMore: boolean;
}
