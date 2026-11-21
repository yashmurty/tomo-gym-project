import type {
  ContentBlockParam,
  MessageParam,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/messages';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryFailedError } from 'typeorm';

import {
  UndoResult,
  UndoService,
} from '../../action-log/services/undo.service';
import {
  CHAT_ROLE,
  ChatMessage,
  TURN_STATUS,
} from '../../chat/entities/chat-message.entity';
import { ChatMessageService } from '../../chat/services/chat-message.service';
import { TurnTokenService } from '../../mcp/services/turn-token.service';
import { QuotaExceededException } from '../../shared/exceptions/quota-exceeded.exception';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { Clock } from '../../shared/time/clock';
import { BudgetService } from '../../usage/services/budget.service';
import { LlmUsageService } from '../../usage/services/llm-usage.service';
import { RateLimitService } from '../../usage/services/rate-limit.service';
import { UserService } from '../../user/services/user.service';
import { ChatEvent, ChatInput } from '../dtos/chat.dto';
import {
  LLM_CLIENT,
  LlmClient,
  LlmContentBlock,
  LlmToolUseBlock,
} from '../llm/llm-client';
import { McpToolClient } from './mcp-tool-client';
import { contextBlock, SYSTEM_PROMPT } from './system-prompt';

// Model ↔ tool round trips per turn before giving up (a turn normally needs
// 2: tool call, then confirmation).
const MAX_STEPS = 6;
const HISTORY_TURNS = 10;
const PG_UNIQUE_VIOLATION = '23505';

export type Emit = (event: ChatEvent) => void;

@Injectable()
export class AgentService {
  constructor(
    @Inject(LLM_CLIENT) private readonly llm: LlmClient,
    private readonly mcp: McpToolClient,
    private readonly turnTokens: TurnTokenService,
    private readonly chat: ChatMessageService,
    private readonly userService: UserService,
    private readonly undoService: UndoService,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
    private readonly clock: Clock,
    private readonly usage: LlmUsageService,
    private readonly rateLimits: RateLimitService,
    private readonly budget: BudgetService,
  ) {
    this.logger.setContext(AgentService.name);
  }

  // One chat turn, streamed through `emit`. Never throws: failures become an
  // `error` event and the turn is marked failed.
  async handleTurn(
    ctx: RequestContext,
    input: ChatInput,
    emit: Emit,
  ): Promise<void> {
    this.logger.log(ctx, `${this.handleTurn.name} was called`);
    const userId = ctx.user!.id;

    // Idempotency (constitution rule 11): a retry replays, never re-runs.
    const existing = await this.chat.findTurnByIdempotencyKey(
      userId,
      input.idempotencyKey,
    );
    if (existing) return this.replay(existing, emit);

    let turn: ChatMessage;
    try {
      turn = await this.chat.startTurn(
        userId,
        input.text,
        input.idempotencyKey,
      );
    } catch (err) {
      // A concurrent request with the same key won the insert.
      if (
        err instanceof QueryFailedError &&
        (err as any).code === PG_UNIQUE_VIOLATION
      ) {
        const winner = await this.chat.findTurnByIdempotencyKey(
          userId,
          input.idempotencyKey,
        );
        if (winner) return this.replay(winner, emit);
      }
      throw err;
    }
    emit({ type: 'turn', turnId: turn.id, replayed: false });

    try {
      await this.runLoop(ctx, turn, emit);
      await this.chat.finishTurn(turn.id, TURN_STATUS.COMPLETED);
      emit({ type: 'done', turnId: turn.id });
    } catch (err) {
      await this.chat.finishTurn(turn.id, TURN_STATUS.FAILED);
      if (err instanceof QuotaExceededException) {
        // Budget ran out mid-turn: what was saved so far stays (undoable).
        emit({ type: 'error', code: err.code, message: err.message });
        return;
      }
      this.logger.error(ctx, `turn ${turn.id} failed`, {
        stack: (err as Error).stack,
      });
      emit({
        type: 'error',
        message: 'Something went wrong; nothing more was saved.',
      });
    }
  }

  // Runs before the response starts streaming, so limits come back as a
  // plain 429 with Retry-After (constitution rule 17). A retry of a stored
  // message is a free replay: never counted, never blocked.
  async preflight(ctx: RequestContext, input: ChatInput): Promise<void> {
    const userId = ctx.user!.id;
    if (
      await this.chat.findTurnByIdempotencyKey(userId, input.idempotencyKey)
    ) {
      return;
    }

    const limits = this.config.get<Record<string, number>>('limits')!;
    await this.rateLimits.consume([
      {
        key: `chat:user:${userId}`,
        window: 'minute',
        limit: limits.chatPerMinute,
      },
      { key: `chat:user:${userId}`, window: 'day', limit: limits.chatPerDay },
    ]);

    const user = await this.userService.getSelfProfile(ctx);
    await this.budget.assertWithinBudget(user);
  }

  // Undo every change the agent made in a turn (constitution rule 13).
  async undoTurn(ctx: RequestContext, turnId: number): Promise<UndoResult> {
    const turn = await this.chat.findUserTurn(ctx.user!.id, turnId);
    if (!turn) throw new NotFoundException(`Message ${turnId} not found`);
    return this.undoService.undoGroup(ctx, `msg:${turn.id}`);
  }

  private async runLoop(
    ctx: RequestContext,
    turn: ChatMessage,
    emit: Emit,
  ): Promise<void> {
    const user = await this.userService.getSelfProfile(ctx);
    const history = await this.chat.recentHistory(user.id, HISTORY_TURNS);

    // Only the current message carries the context block; stored history
    // never does, so the model can't pick up a stale date (rule 8).
    const conversation: MessageParam[] = [
      ...toMessageParams(history),
      {
        role: 'user',
        content: [
          { type: 'text', text: contextBlock(user, this.clock.now()) },
          { type: 'text', text: turn.text ?? '' },
        ],
      },
    ];

    const session = await this.mcp.connect(
      this.turnTokens.mint({ userId: user.id, turnId: turn.id }),
    );
    try {
      const tools = (await session.listTools()).map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as { type: 'object'; [k: string]: unknown },
        strict: true,
      }));

      for (let step = 0; step < MAX_STEPS; step++) {
        // Before every model call, not just once per turn (rule 17).
        await this.budget.assertWithinBudget(user);
        const response = await this.llm.createMessage({
          model: this.config.get<string>('llm.model')!,
          system: SYSTEM_PROMPT,
          messages: conversation,
          tools,
          maxTokens: this.config.get<number>('llm.maxTokens')!,
        });
        await this.usage.record(user.id, turn.id, {
          model: response.model,
          ...response.usage,
        });

        const text = textOf(response.content);
        await this.chat.append(
          user.id,
          turn.id,
          CHAT_ROLE.ASSISTANT,
          response.content,
          text || null,
        );
        conversation.push({
          role: 'assistant',
          content: response.content as ContentBlockParam[],
        });
        if (text) emit({ type: 'text', text });

        if (response.stopReason !== 'tool_use') return;

        const results: ToolResultBlockParam[] = [];
        for (const call of response.content.filter(isToolUse)) {
          const outcome = await session.callTool(call.name, call.input);
          results.push({
            type: 'tool_result',
            tool_use_id: call.id,
            content: outcome.text,
            ...(outcome.isError ? { is_error: true } : {}),
          });
          emit(toolEvent(call.name, outcome.text, outcome.isError));
        }
        await this.chat.append(
          user.id,
          turn.id,
          CHAT_ROLE.TOOL_RESULT,
          results,
          null,
        );
        conversation.push({ role: 'user', content: results });
      }

      emit({ type: 'text', text: 'Stopped: that took too many steps.' });
    } finally {
      await session.close();
    }
  }

  private async replay(turn: ChatMessage, emit: Emit): Promise<void> {
    emit({ type: 'turn', turnId: turn.id, replayed: true });
    if (turn.status === TURN_STATUS.PENDING) {
      emit({
        type: 'error',
        message: 'This message is still being processed.',
      });
      return;
    }

    const toolNames = new Map<string, string>();
    for (const message of await this.chat.turnMessages(turn.id)) {
      if (message.role === CHAT_ROLE.ASSISTANT) {
        for (const block of message.content as LlmContentBlock[]) {
          if (block.type === 'tool_use') toolNames.set(block.id, block.name);
        }
        if (message.text) emit({ type: 'text', text: message.text });
      } else if (message.role === CHAT_ROLE.TOOL_RESULT) {
        for (const result of message.content as ToolResultBlockParam[]) {
          emit(
            toolEvent(
              toolNames.get(result.tool_use_id) ?? 'unknown',
              typeof result.content === 'string' ? result.content : '',
              result.is_error === true,
            ),
          );
        }
      }
    }

    if (turn.status === TURN_STATUS.FAILED) {
      emit({
        type: 'error',
        message: 'Something went wrong; nothing more was saved.',
      });
    } else {
      emit({ type: 'done', turnId: turn.id });
    }
  }
}

function isToolUse(block: LlmContentBlock): block is LlmToolUseBlock {
  return block.type === 'tool_use';
}

function textOf(content: LlmContentBlock[]): string {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('\n')
    .trim();
}

function toolEvent(name: string, text: string, isError: boolean): ChatEvent {
  if (isError) return { type: 'tool', name, ok: false, error: text };
  try {
    return { type: 'tool', name, ok: true, result: JSON.parse(text) };
  } catch {
    return { type: 'tool', name, ok: true, result: text };
  }
}

// Stored transcript → Messages API messages. Consecutive same-role messages
// are merged (e.g. a turn that ended on tool results followed by the next
// user message), keeping tool_result blocks first as the API requires.
export function toMessageParams(history: ChatMessage[]): MessageParam[] {
  const out: MessageParam[] = [];
  for (const message of history) {
    const role = message.role === CHAT_ROLE.ASSISTANT ? 'assistant' : 'user';
    const blocks: ContentBlockParam[] =
      typeof message.content === 'string'
        ? [{ type: 'text', text: message.content }]
        : (message.content as ContentBlockParam[]);

    const previous = out[out.length - 1];
    if (previous && previous.role === role) {
      previous.content = [
        ...(previous.content as ContentBlockParam[]),
        ...blocks,
      ];
    } else {
      out.push({ role, content: blocks });
    }
  }
  return out;
}
