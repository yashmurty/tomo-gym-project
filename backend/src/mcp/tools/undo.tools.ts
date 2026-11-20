import { Injectable } from '@nestjs/common';

import { UndoService } from '../../action-log/services/undo.service';
import { McpTool, ToolContext } from './mcp-tool';

@Injectable()
export class UndoLastTool implements McpTool {
  readonly name = 'undo_last';
  readonly description =
    "Undo the previous change set: in tomo's chat, everything saved by the user's previous message; for external clients, the previous tool call made with this token. Changes edited since are left alone and reported as skipped.";
  readonly inputSchema = {
    type: 'object' as const,
    properties: {},
    additionalProperties: false as const,
  };

  constructor(private readonly undoService: UndoService) {}

  async run({ ctx, undoScope }: ToolContext) {
    const result = await this.undoService.undoLast(ctx, undoScope);
    return { undone: result.undone, skipped: result.skipped };
  }
}
