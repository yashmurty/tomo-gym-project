import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ChatMessage } from '../../chat/entities/chat-message.entity';
import { Exercise } from '../../exercise/entities/exercise.entity';
import { numericTransformer } from '../../shared/typeorm/numeric.transformer';
import { User } from '../../user/entities/user.entity';
import { ENTRY_SOURCE } from '../constants/workout.constant';
import { EntrySet } from './entry-set.entity';
import { WorkoutSession } from './workout-session.entity';

const numeric = (precision: number, scale: number) => ({
  type: 'numeric' as const,
  precision,
  scale,
  nullable: true,
  transformer: numericTransformer,
});

// One exercise performed on one day. Strength / bodyweight work keeps its
// sets in entry_sets; cardio uses the duration / distance / speed / incline
// columns. Which shape applies is decided by the exercise's modality and
// enforced in WorkoutService.
@Entity('entries')
@Index('IDX_entries_session', ['sessionId'])
@Index('IDX_entries_user_exercise', ['userId', 'exerciseId'])
export class Entry {
  @PrimaryGeneratedColumn()
  id: number;

  // Denormalised from the session so ownership checks and per-user queries
  // don't need a join.
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column()
  sessionId: number;

  @ManyToOne(() => WorkoutSession, (session) => session.entries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sessionId' })
  session?: WorkoutSession;

  @Column()
  exerciseId: number;

  @ManyToOne(() => Exercise, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'exerciseId' })
  exercise?: Exercise;

  @OneToMany(() => EntrySet, (set) => set.entry, { cascade: ['insert'] })
  sets?: EntrySet[];

  @Column(numeric(6, 2))
  durationMin: number | null;

  @Column(numeric(6, 2))
  distanceKm: number | null;

  @Column(numeric(4, 1))
  speedKmh: number | null;

  @Column(numeric(4, 1))
  inclinePct: number | null;

  // The MET the estimate used, and the estimate itself. Computed server-side
  // at write time and on every edit (constitution rule 9). Null kcal = the
  // user hasn't set a body weight yet.
  @Column(numeric(4, 2))
  metValue: number | null;

  @Column(numeric(7, 1))
  estKcal: number | null;

  // What the user typed, for chat-originated entries (constitution rule 12).
  @Column({ type: 'text', nullable: true })
  rawInput: string | null;

  @Column({ type: 'varchar', length: 8 })
  source: ENTRY_SOURCE;

  // External MCP client name, for source = mcp.
  @Column({ type: 'varchar', length: 100, nullable: true })
  sourceClient: string | null;

  // Chat message (turn) that produced the entry.
  @Column({ type: 'int', nullable: true })
  sourceMessageId: number | null;

  @ManyToOne(() => ChatMessage, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sourceMessageId' })
  sourceMessage?: ChatMessage | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Soft delete, so undoing a delete can restore the row (Step 4/5).
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
