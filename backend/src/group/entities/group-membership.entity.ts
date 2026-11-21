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
import { GROUP_ROLE } from '../constants/group.constant';
import { Group } from './group.entity';

// A user's place in a group (copied from denwa-alert's Membership, minus
// teams and invitations). A user is in a group at most once, and a group
// has exactly one owner.
@Entity('group_memberships')
@Index('UQ_group_memberships_group_user', ['groupId', 'userId'], {
  unique: true,
})
@Index('UQ_group_memberships_one_owner', ['groupId'], {
  unique: true,
  where: `"role" = 'owner'`,
})
@Index('IDX_group_memberships_user', ['userId'])
export class GroupMembership {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  groupId: number;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group?: Group;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar', length: 10 })
  role: GROUP_ROLE;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt: Date;
}
