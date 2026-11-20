import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { CalendarDate } from '../../shared/time/calendar-date';
import { User } from '../../user/entities/user.entity';
import { Entry } from './entry.entity';

// One training day for one user. Created implicitly by the first entry
// logged for that date (no "start session" step). The day number is never
// stored: it's computed at read time from the user's days that still have
// live entries, so edits can't make it drift.
@Entity('sessions')
@Unique('UQ_sessions_user_date', ['userId', 'date'])
export class WorkoutSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  // Calendar day in the user's timezone, as 'YYYY-MM-DD' (never a JS Date).
  @Column({ type: 'date' })
  date: CalendarDate;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @OneToMany(() => Entry, (entry) => entry.session)
  entries?: Entry[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
