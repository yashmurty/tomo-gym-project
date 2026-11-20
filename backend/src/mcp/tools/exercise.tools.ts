import { Injectable } from '@nestjs/common';

import { CreateExerciseInput } from '../../exercise/dtos/exercise-create-input.dto';
import { ExerciseService } from '../../exercise/services/exercise.service';
import { McpTool, ToolContext } from './mcp-tool';
import { schema } from './tool-helpers';
import { AddExerciseAliasInput } from './tool-inputs.dto';

@Injectable()
export class CreateExerciseTool implements McpTool<CreateExerciseInput> {
  readonly name = 'create_exercise';
  readonly description =
    "Create a custom exercise when the user's exercise is genuinely not in the catalog (log_entry said it's unknown and no suggestion fits). Then log the entry.";
  readonly inputDto = CreateExerciseInput;
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'English name.' },
      nameJa: { type: 'string', description: 'Japanese name, if known.' },
      modality: { type: 'string', enum: ['strength', 'bodyweight', 'cardio'] },
      muscleGroup: {
        type: 'string',
        enum: [
          'chest',
          'back',
          'shoulders',
          'arms',
          'legs',
          'core',
          'full_body',
          'cardio',
        ],
      },
    },
    required: ['name', 'modality', 'muscleGroup'],
    additionalProperties: false as const,
  };

  constructor(private readonly exerciseService: ExerciseService) {}

  run(toolCtx: ToolContext, input: CreateExerciseInput) {
    return this.exerciseService.create(toolCtx.ctx, input, {
      actionGroup: toolCtx.origin.actionGroup,
      tool: this.name,
    });
  }
}

@Injectable()
export class AddExerciseAliasTool implements McpTool<AddExerciseAliasInput> {
  readonly name = 'add_exercise_alias';
  readonly description =
    'Remember the user\'s own name for an existing exercise (e.g. after they confirm "fly" means Pec fly), so it resolves directly next time.';
  readonly inputDto = AddExerciseAliasInput;
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      alias: { type: 'string', description: 'The name as the user writes it.' },
      exercise: schema.exercise,
      exerciseId: schema.exerciseId,
    },
    required: ['alias'],
    additionalProperties: false as const,
  };

  constructor(private readonly exerciseService: ExerciseService) {}

  run(toolCtx: ToolContext, input: AddExerciseAliasInput) {
    return this.exerciseService.addAlias(
      toolCtx.ctx,
      { exercise: input.exercise, exerciseId: input.exerciseId },
      input.alias,
      { actionGroup: toolCtx.origin.actionGroup, tool: this.name },
    );
  }
}
