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
import {
  ChatEvent,
  ChatHistoryOutput,
  ChatHistoryQuery,
  ChatInput,
  TurnEvent,
} from '../dtos/chat.dto';
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
const HISTORY_PAGE = 20;
const FAILED_MESSAGE = 'Something went wrong; nothing more was saved.';
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
    if (existing) return this.replay(ctx, existing, emit);

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
        if (winner) return this.replay(ctx, winner, emit);
      }
      throw err;
    }
    emit({ type: 'turn', turnId: turn.id, replayed: false });

    try {
      await this.runLoop(ctx, turn, emit);
      await this.chat.finishTurn(turn.id, TURN_STATUS.COMPLETED);
      emit({
        type: 'done',
        turnId: turn.id,
        changes: await this.changesIn(ctx, turn.id),
      });
    } catch (err) {
      await this.chat.finishTurn(turn.id, TURN_STATUS.FAILED);
      // What was saved before the failure stays, and stays undoable.
      const changes = await this.changesIn(ctx, turn.id).catch(() => undefined);
      if (err instanceof QuotaExceededException) {
        emit({ type: 'error', code: err.code, message: err.message, changes });
        return;
      }
      this.logger.error(ctx, `turn ${turn.id} failed`, {
        stack: (err as Error).stack,
      });
      emit({ type: 'error', message: FAILED_MESSAGE, changes });
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

  // The user's own chat, a page at a time, oldest first within the page:
  // each turn with the events the stream sent and whether it can be undone,
  // so the chat (and its Undo buttons) survive a reload. Scoped to the
  // caller by the JWT; the transcript is never visible to anyone else
  // (constitution rule 16).
  async history(
    ctx: RequestContext,
    query: ChatHistoryQuery,
  ): Promise<ChatHistoryOutput> {
    this.logger.log(ctx, `${this.history.name} was called`);
    const limit = query.limit ?? HISTORY_PAGE;
    const newestFirst = await this.chat.listTurns(
      ctx.user!.id,
      query.before,
      limit + 1,
    );
    const page = newestFirst.slice(0, limit).reverse();

    const messages = await this.chat.messagesOfTurns(page.map((t) => t.id));
    const byTurn = new Map<number, ChatMessage[]>();
    for (const message of messages) {
      const list = byTurn.get(message.turnId!) ?? [];
      list.push(message);
      byTurn.set(message.turnId!, list);
    }
    const states = await this.undoService.groupStates(
      ctx,
      page.map((t) => `msg:${t.id}`),
    );

    return {
      hasMore: newestFirst.length > limit,
      turns: page.map((turn) => {
        const state = states.get(`msg:${turn.id}`);
        return {
          id: turn.id,
          text: turn.text ?? '',
          status: turn.status ?? TURN_STATUS.COMPLETED,
          createdAt: turn.createdAt,
          events: turnEvents(byTurn.get(turn.id) ?? []),
          changes: state?.active ?? 0,
          undone: !!state && state.total > 0 && state.active === 0,
        };
      }),
    };
  }

  private async changesIn(ctx: RequestContext, turnId: number) {
    const key = `msg:${turnId}`;
    const states = await this.undoService.groupStates(ctx, [key]);
    return states.get(key)?.active ?? 0;
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

  private async replay(
    ctx: RequestContext,
    turn: ChatMessage,
    emit: Emit,
  ): Promise<void> {
    emit({ type: 'turn', turnId: turn.id, replayed: true });
    if (turn.status === TURN_STATUS.PENDING) {
      emit({
        type: 'error',
        message: 'This message is still being processed.',
      });
      return;
    }

    for (const event of turnEvents(await this.chat.turnMessages(turn.id))) {
      emit(event);
    }

    const changes = await this.changesIn(ctx, turn.id);
    if (turn.status === TURN_STATUS.FAILED) {
      emit({ type: 'error', message: FAILED_MESSAGE, changes });
    } else {
      emit({ type: 'done', turnId: turn.id, changes });
    }
  }
}

// A stored turn's replies and tool calls as the events the stream sent, in
// order. Used to replay a retried message and to show chat history.
export function turnEvents(messages: ChatMessage[]): TurnEvent[] {
  const events: TurnEvent[] = [];
  const toolNames = new Map<string, string>();
  for (const message of messages) {
    if (message.role === CHAT_ROLE.ASSISTANT) {
      for (const block of message.content as LlmContentBlock[]) {
        if (block.type === 'tool_use') toolNames.set(block.id, block.name);
      }
      if (message.text) events.push({ type: 'text', text: message.text });
    } else if (message.role === CHAT_ROLE.TOOL_RESULT) {
      for (const result of message.content as ToolResultBlockParam[]) {
        events.push(
          toolEvent(
            toolNames.get(result.tool_use_id) ?? 'unknown',
            typeof result.content === 'string' ? result.content : '',
            result.is_error === true,
          ),
        );
      }
    }
  }
  return events;
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

function toolEvent(name: string, text: string, isError: boolean): TurnEvent {
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
