import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../../user/entities/user.entity';

export enum CHAT_ROLE {
  // What the user typed. Starts a turn.
  USER = 'user',
  // A model reply (text and/or tool_use blocks).
  ASSISTANT = 'assistant',
  // Tool results sent back to the model (a `user` message in API terms).
  TOOL_RESULT = 'tool_result',
}

export enum TURN_STATUS {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// The chat transcript. Each user message starts a turn; the model replies
// and tool results of that turn point back to it via turnId. `content`
// holds Messages API content blocks verbatim, so history can be replayed to
// the API faithfully.
@Entity('chat_messages')
@Index('UQ_chat_messages_user_idempotency', ['userId', 'idempotencyKey'], {
  unique: true,
  where: '"idempotencyKey" IS NOT NULL',
})
@Index('IDX_chat_messages_turn', ['turnId'])
@Index('IDX_chat_messages_user_created', ['userId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  // The user message that started this turn; null on that message itself.
  @Column({ type: 'int', nullable: true })
  turnId: number | null;

  @Column({ type: 'varchar', length: 12 })
  role: CHAT_ROLE;

  @Column({ type: 'jsonb' })
  content: unknown;

  // Plain text for display and for raw_input (user messages, final replies).
  @Column({ type: 'text', nullable: true })
  text: string | null;

  // Client-generated, on user messages only (constitution rule 11).
  @Column({ type: 'varchar', length: 64, nullable: true })
  idempotencyKey: string | null;

  // On user messages only.
  @Column({ type: 'varchar', length: 12, nullable: true })
  status: TURN_STATUS | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
