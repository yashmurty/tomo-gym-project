import { Type } from '@nestjs/common';

import { UndoScope } from '../../action-log/services/undo.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { WEIGHT_UNIT } from '../../shared/units/weight';
import { EntryOrigin } from '../../workout/services/workout.service';

// What a tool handler gets: who is acting and where the call came from.
// Read-only values only, with no database handle. Tools reach data
// exclusively through services (enforced by the ESLint rule on this folder).
export interface ToolContext {
  readonly ctx: RequestContext;
  readonly origin: Readonly<EntryOrigin>;
  // Which earlier changes undo_last may reverse: the caller's previous chat
  // turns, or earlier calls made with the same access token.
  readonly undoScope: Readonly<UndoScope>;
  // The user's display unit. Results echo weights in it next to kg, so
  // neither the model nor the app ever converts.
  readonly weightUnit: WEIGHT_UNIT;
}

export interface JsonSchemaObject {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
}

export interface McpTool<Input extends object = object> {
  readonly name: string;
  readonly description: string;
  // The DTO class the input is validated against (same rules as REST).
  // Omitted for tools that take no arguments.
  readonly inputDto?: Type<Input>;
  // The schema advertised to clients. Must list exactly the DTO's fields;
  // a unit test enforces it.
  readonly inputSchema: JsonSchemaObject;
  run(toolCtx: ToolContext, input: Input): Promise<unknown>;
}
