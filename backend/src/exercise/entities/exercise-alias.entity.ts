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
import { MAX_EXERCISE_NAME_LENGTH } from '../constants/exercise.constant';
import { Exercise } from './exercise.entity';

// A surface form that resolves to an exercise ("pec deck" → Pec fly).
// userId NULL = shared alias (seeded); otherwise learned for one user, which
// takes precedence over a shared alias with the same key.
@Entity('exercise_aliases')
@Index('UQ_exercise_aliases_global', ['normalizedAlias'], {
  unique: true,
  where: '"userId" IS NULL',
})
@Index('UQ_exercise_aliases_user', ['userId', 'normalizedAlias'], {
  unique: true,
  where: '"userId" IS NOT NULL',
})
export class ExerciseAlias {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User | null;

  @Column()
  exerciseId: number;

  @ManyToOne(() => Exercise, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exerciseId' })
  exercise?: Exercise;

  // As typed, for display.
  @Column({ length: MAX_EXERCISE_NAME_LENGTH })
  alias: string;

  // normalizeExerciseName(alias): the lookup key.
  @Column({ length: MAX_EXERCISE_NAME_LENGTH })
  normalizedAlias: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
