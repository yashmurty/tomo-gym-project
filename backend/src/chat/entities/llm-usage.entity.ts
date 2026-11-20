import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// One row per model call: the basis for per-user budgets (constitution
// rule 17, Step 6) and cost reporting.
@Entity('llm_usage')
@Index('IDX_llm_usage_user_created', ['userId', 'createdAt'])
export class LlmUsage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  // The user message whose turn made the call.
  @Column()
  turnId: number;

  @Column({ length: 64 })
  model: string;

  @Column({ type: 'int' })
  inputTokens: number;

  @Column({ type: 'int' })
  outputTokens: number;

  @Column({ type: 'int', default: 0 })
  cacheReadTokens: number;

  @Column({ type: 'int', default: 0 })
  cacheWriteTokens: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
