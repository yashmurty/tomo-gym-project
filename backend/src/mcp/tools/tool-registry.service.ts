import {
  BadRequestException,
  HttpException,
  Injectable,
  ValidationPipe,
} from '@nestjs/common';

import { VALIDATION_PIPE_OPTIONS } from '../../shared/constants';
import { AppLogger } from '../../shared/logger/logger.service';
import {
  DeleteEntryTool,
  GetDayTool,
  GetLastEntryTool,
  MoveEntriesTool,
  QueryHistoryTool,
  SetDayNoteTool,
  UpdateEntryTool,
} from './entry.tools';
import { AddExerciseAliasTool, CreateExerciseTool } from './exercise.tools';
import { LogEntryTool } from './log-entry.tool';
import { McpTool, ToolContext } from './mcp-tool';
import { GetProfileTool, UpdateProfileTool } from './profile.tools';
import { UndoLastTool } from './undo.tools';

export type ToolOutcome =
  | { ok: true; result: unknown }
  | { ok: false; error: string };

// The production REST validation settings, plus rejecting unknown fields:
// for tools, an unexpected field means model confusion or a prompt
// injection attempt, so it's an error (and logged), never silently dropped.
const toolPipe = new ValidationPipe({
  ...VALIDATION_PIPE_OPTIONS,
  forbidNonWhitelisted: true,
});

@Injectable()
export class ToolRegistry {
  private readonly tools: Map<string, McpTool>;

  constructor(
    logEntry: LogEntryTool,
    getDay: GetDayTool,
    getLastEntry: GetLastEntryTool,
    queryHistory: QueryHistoryTool,
    updateEntry: UpdateEntryTool,
    deleteEntry: DeleteEntryTool,
    moveEntries: MoveEntriesTool,
    setDayNote: SetDayNoteTool,
    createExercise: CreateExerciseTool,
    addExerciseAlias: AddExerciseAliasTool,
    getProfile: GetProfileTool,
    updateProfile: UpdateProfileTool,
    undoLast: UndoLastTool,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(ToolRegistry.name);
    const tools: McpTool<any>[] = [
      logEntry,
      getDay,
      getLastEntry,
      queryHistory,
      updateEntry,
      deleteEntry,
      moveEntries,
      setDayNote,
      createExercise,
      addExerciseAlias,
      getProfile,
      updateProfile,
      undoLast,
    ];
    this.tools = new Map(tools.map((t) => [t.name, t as McpTool]));
  }

  // Every registered tool (for tests).
  all(): McpTool[] {
    return [...this.tools.values()];
  }

  list(): { name: string; description: string; inputSchema: object }[] {
    return this.all().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  // Validates and runs a tool. Never throws: bad input and domain errors
  // become an error outcome the caller returns to the model as a tool error.
  async call(
    name: string,
    args: unknown,
    toolCtx: ToolContext,
  ): Promise<ToolOutcome> {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, error: `Unknown tool '${name}'` };

    let input: object;
    try {
      input = await this.validate(tool, args);
    } catch (err) {
      const error = describe(err);
      this.logger.warn(
        toolCtx.ctx,
        `Rejected ${name} input from user ${toolCtx.ctx.user?.id} (${toolCtx.origin.source}): ${error}`,
      );
      return { ok: false, error: `Invalid input: ${error}` };
    }

    try {
      return { ok: true, result: await tool.run(toolCtx, input) };
    } catch (err) {
      if (err instanceof HttpException) {
        return { ok: false, error: describe(err) };
      }
      this.logger.error(toolCtx.ctx, `${name} failed`, {
        stack: (err as Error).stack,
      });
      return { ok: false, error: 'Internal error' };
    }
  }

  private async validate(tool: McpTool, args: unknown): Promise<object> {
    const value = args ?? {};
    if (!tool.inputDto) {
      // Tools without arguments still reject any, like unknown fields.
      const keys = Object.keys(value as object);
      if (keys.length) {
        throw new BadRequestException(
          keys.map((k) => `property ${k} should not exist`),
        );
      }
      return {};
    }
    return toolPipe.transform(value, { type: 'body', metatype: tool.inputDto });
  }
}

function describe(err: unknown): string {
  if (err instanceof HttpException) {
    const response = err.getResponse();
    const message =
      typeof response === 'object' && response !== null && 'message' in response
        ? (response as { message: unknown }).message
        : err.message;
    return Array.isArray(message) ? message.join('; ') : String(message);
  }
  return (err as Error).message;
}
