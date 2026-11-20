import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { numericTransformer } from '../../shared/typeorm/numeric.transformer';
import { Entry } from './entry.entity';

// One set of a strength / bodyweight entry. "2x10 @ 47kg" is two identical
// rows; pyramids and drop sets are rows that differ (roadmap Step 3, item 5).
@Entity('entry_sets')
@Unique('UQ_entry_sets_entry_index', ['entryId', 'setIndex'])
export class EntrySet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  entryId: number;

  @ManyToOne(() => Entry, (entry) => entry.sets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entryId' })
  entry?: Entry;

  // 1-based position within the entry.
  @Column({ type: 'smallint' })
  setIndex: number;

  @Column({ type: 'smallint' })
  reps: number;

  // Always kg. Null = no load recorded (or bodyweight with no added load).
  @Column({
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  weightKg: number | null;
}
