import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

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
  | { type: 'done'; turnId: number }
  | { type: 'error'; message: string };
