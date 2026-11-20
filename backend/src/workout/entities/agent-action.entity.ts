import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// One change the agent (or an external MCP client) made to workout data,
// recorded in the same transaction as the change itself. Writes are grouped
// per action group (a chat message, or one external MCP request), and undo
// reverses a whole group (constitution rule 13).
@Entity('agent_actions')
@Index('IDX_agent_actions_user_group', ['userId', 'groupKey'])
export class AgentAction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  // 'msg:<chat message id>' or 'mcp:<request uuid>'.
  @Column({ length: 64 })
  groupKey: string;

  // The tool that made the change, e.g. 'log_entry'.
  @Column({ length: 50 })
  tool: string;

  @Column({ length: 20 })
  entityType: string;

  @Column()
  entityId: number;

  // Row snapshots. before = null means the action created the row.
  @Column({ type: 'jsonb', nullable: true })
  before: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  undoneAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
