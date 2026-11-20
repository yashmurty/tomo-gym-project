import { Injectable } from '@nestjs/common';

import { todayIn } from '../../shared/time/calendar-date';
import { Clock } from '../../shared/time/clock';
import { UpdateUserInput } from '../../user/dtos/user-update-input.dto';
import { UserService } from '../../user/services/user.service';
import { McpTool, ToolContext } from './mcp-tool';
import { UpdateProfileToolInput } from './tool-inputs.dto';

const profileOf = (user: {
  timezone: string;
  locale: string;
  weightUnit: string;
  weightKg: number | null;
}) => ({
  timezone: user.timezone,
  locale: user.locale,
  weightUnit: user.weightUnit,
  weightKg: user.weightKg,
});

@Injectable()
export class GetProfileTool implements McpTool {
  readonly name = 'get_profile';
  readonly description =
    "The user's timezone, today's date in it, preferred language and weight unit. External clients: call this first. tomo's own chat already has it in the <context> block.";
  readonly inputSchema = {
    type: 'object' as const,
    properties: {},
    additionalProperties: false as const,
  };

  constructor(
    private readonly userService: UserService,
    private readonly clock: Clock,
  ) {}

  async run({ ctx }: ToolContext) {
    const user = await this.userService.getSelfProfile(ctx);
    return {
      ...profileOf(user),
      today: todayIn(user.timezone, this.clock.now()),
    };
  }
}

@Injectable()
export class UpdateProfileTool implements McpTool<UpdateProfileToolInput> {
  readonly name = 'update_profile';
  readonly description =
    'Update body weight ("I weigh 72 kg now"; weight is in weightUnit if given, else the saved unit), preferred unit, timezone or language. Undoable.';
  readonly inputDto = UpdateProfileToolInput;
  readonly inputSchema = {
    type: 'object' as const,
    properties: {
      weight: {
        type: ['number', 'null'],
        description: 'Body weight; null clears it.',
      },
      weightUnit: { type: 'string', enum: ['kg', 'lb'] },
      timezone: { type: 'string', description: 'IANA name, e.g. Asia/Tokyo.' },
      locale: { type: 'string', enum: ['en', 'ja'] },
    },
    additionalProperties: false as const,
  };

  constructor(private readonly userService: UserService) {}

  async run(toolCtx: ToolContext, input: UpdateProfileToolInput) {
    // Only these four fields, copied explicitly: never name / password.
    const changes: UpdateUserInput = {};
    if (input.weight !== undefined) changes.weight = input.weight;
    if (input.weightUnit !== undefined) changes.weightUnit = input.weightUnit;
    if (input.timezone !== undefined) changes.timezone = input.timezone;
    if (input.locale !== undefined) changes.locale = input.locale;

    const user = await this.userService.updateUser(
      toolCtx.ctx,
      toolCtx.ctx.user!.id,
      changes,
      { actionGroup: toolCtx.origin.actionGroup, tool: this.name },
    );
    return profileOf(user);
  }
}
