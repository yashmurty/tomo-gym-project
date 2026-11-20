import { EntityManager } from 'typeorm';

import { AgentAction } from './entities/agent-action.entity';

export type ActionEntityType =
  | 'entry'
  | 'session'
  | 'exercise'
  | 'exercise_alias'
  | 'user';

// Server-side facts about who/what made a change. Present for writes made
// by the agent or an external MCP client; absent for the app's own forms
// (those aren't undoable from chat).
export interface ActionOrigin {
  // 'msg:<chat turn id>' or 'mcp:<token id>:<request uuid>'.
  actionGroup?: string;
  // The tool that made the change, e.g. 'update_entry'.
  tool?: string;
}

// Records a change in agent_actions, in the caller's transaction, so the
// change and its undo record commit or roll back together. A no-op for
// writes without an action group.
export async function recordAction(
  manager: EntityManager,
  record: {
    userId: number;
    origin: ActionOrigin | undefined;
    entityType: ActionEntityType;
    entityId: number;
    before: object | null;
    after: object | null;
  },
): Promise<void> {
  if (!record.origin?.actionGroup) return;
  await manager.insert(AgentAction, {
    userId: record.userId,
    groupKey: record.origin.actionGroup,
    tool: record.origin.tool ?? 'unknown',
    entityType: record.entityType,
    entityId: record.entityId,
    // jsonb columns: TypeORM's deep-partial typing can't express arbitrary
    // JSON, hence the casts.
    before: record.before as any,
    after: record.after as any,
  });
}
