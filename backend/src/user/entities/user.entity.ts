import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Article } from '../../article/entities/article.entity';
import { LOCALE } from '../../shared/constants/locale.constant';
import { MAX_TIMEZONE_LENGTH } from '../../shared/time/timezone';
import { numericTransformer } from '../../shared/typeorm/numeric.transformer';
import { WEIGHT_UNIT } from '../../shared/units/weight';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column()
  password: string;

  @Column('simple-array')
  roles: string[];

  @Column()
  isAccountDisabled: boolean;

  @Unique('email', ['email'])
  @Column({ length: 200 })
  email: string;

  // IANA name, stored exactly as sent (validated, not canonicalised). Used to
  // resolve "today" on every request (constitution rule 8).
  @Column({ length: MAX_TIMEZONE_LENGTH })
  timezone: string;

  @Column({ type: 'varchar', length: 5 })
  locale: LOCALE;

  // Always kg; null until the user tells us. Only data a feature uses is
  // collected (constitution rule 16): weight feeds calorie estimates.
  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  weightKg: number | null;

  // Display preference only; storage is always kg.
  @Column({ type: 'varchar', length: 2, default: WEIGHT_UNIT.KG })
  weightUnit: WEIGHT_UNIT;

  // When the user confirmed they're at least 16 at signup. Null for users
  // created outside signup (e.g. the seeded admin).
  @Column({ type: 'timestamptz', nullable: true })
  ageConfirmedAt: Date | null;

  @CreateDateColumn({ name: 'createdAt', nullable: true })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', nullable: true })
  updatedAt: Date;

  @OneToMany(() => Article, (article) => article.author)
  articles: Article[];
}
