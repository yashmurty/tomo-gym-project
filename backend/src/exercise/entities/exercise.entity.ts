import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { numericTransformer } from '../../shared/typeorm/numeric.transformer';
import { User } from '../../user/entities/user.entity';
import {
  CALORIE_MODEL,
  MAX_EXERCISE_NAME_LENGTH,
  MODALITY,
  MUSCLE_GROUP,
} from '../constants/exercise.constant';

// userId NULL = the shared catalog every user sees; otherwise a user's own
// custom exercise. Names are unique per scope; spelling variants are handled
// by exercise_aliases.
@Entity('exercises')
@Index('UQ_exercises_global_name', ['name'], {
  unique: true,
  where: '"userId" IS NULL',
})
@Index('UQ_exercises_user_name', ['userId', 'name'], {
  unique: true,
  where: '"userId" IS NOT NULL',
})
export class Exercise {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User | null;

  // Display name (English for catalog entries).
  @Column({ length: MAX_EXERCISE_NAME_LENGTH })
  name: string;

  @Column({ type: 'varchar', length: MAX_EXERCISE_NAME_LENGTH, nullable: true })
  nameJa: string | null;

  @Column({ type: 'varchar', length: 12 })
  modality: MODALITY;

  @Column({ type: 'varchar', length: 12 })
  muscleGroup: MUSCLE_GROUP;

  // Metabolic equivalent used for calorie estimates (constitution rule 9).
  @Column({
    type: 'numeric',
    precision: 4,
    scale: 2,
    transformer: numericTransformer,
  })
  defaultMet: number;

  @Column({ type: 'varchar', length: 12, default: CALORIE_MODEL.MET })
  calorieModel: CALORIE_MODEL;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
