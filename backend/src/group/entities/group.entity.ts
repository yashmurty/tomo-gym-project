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
import { GROUP_LIMITS } from '../constants/group.constant';

// A friend group (roadmap Step 12). Joined only through its invite link;
// groups can't be searched.
@Entity('groups')
@Index('UQ_groups_invite_token', ['inviteToken'], { unique: true })
export class Group {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: GROUP_LIMITS.nameLength })
  name: string;

  // Mirrors the one membership with role `owner`; both change together.
  @Column()
  ownerUserId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerUserId' })
  owner?: User;

  // Random 128 bits, URL-safe. Stored as is (not hashed) so any member can
  // copy the link again; resetting replaces it and the old link stops
  // working.
  @Column({ length: 32 })
  inviteToken: string;

  // Off: the link stops working until the owner turns it back on, which
  // brings back the same link.
  @Column({ default: true })
  inviteEnabled: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
