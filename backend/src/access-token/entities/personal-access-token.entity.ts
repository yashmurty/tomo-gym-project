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

// A long-lived token a user creates for an external MCP client (Claude Code
// etc.). Only a SHA-256 hash is stored; the plaintext is shown once at
// creation. Accepted on /mcp only, never on the REST API.
@Entity('personal_access_tokens')
@Index('UQ_personal_access_tokens_hash', ['tokenHash'], { unique: true })
export class PersonalAccessToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  // Shown in the token list and recorded as the source client on entries
  // logged with it (e.g. "Claude Code on my laptop").
  @Column({ length: 100 })
  name: string;

  @Column({ type: 'char', length: 64 })
  tokenHash: string;

  // First characters of the token, so users can tell tokens apart.
  @Column({ length: 20 })
  tokenPrefix: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
