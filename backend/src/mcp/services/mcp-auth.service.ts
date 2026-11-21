import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request } from 'express';

import { AccessTokenService } from '../../access-token/services/access-token.service';
import { UndoScope } from '../../action-log/services/undo.service';
import { ChatMessageService } from '../../chat/services/chat-message.service';
import { REQUEST_ID_TOKEN_HEADER } from '../../shared/constants';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { WEIGHT_UNIT } from '../../shared/units/weight';
import { UserService } from '../../user/services/user.service';
import { ENTRY_SOURCE } from '../../workout/constants/workout.constant';
import { EntryOrigin } from '../../workout/services/workout.service';
import { TurnTokenService } from './turn-token.service';

// Who is calling /mcp and on whose behalf, resolved from the bearer token.
export interface McpCaller {
  // Which earlier changes undo_last may reverse for this caller.
  undoScope: UndoScope;
  // Set for external clients (per access token). Our own agent's calls are
  // already bounded by the chat limits, so they aren't counted again.
  rateLimitKey?: string;
  ctx: RequestContext;
  // The user's display unit, echoed next to kg in tool results.
  weightUnit: WEIGHT_UNIT;
  // Fixed per request for turn tokens (the chat message); per tool call for
  // personal access tokens (see originForCall).
  originForCall: () => EntryOrigin;
}

// /mcp accepts exactly two kinds of bearer token:
//  - a turn token, minted by our own agent loop per chat turn;
//  - a personal access token, created by the user for an external client.
// Login access tokens are rejected: every /mcp call is attributable to one
// of the two (constitution rules 5 and 10).
@Injectable()
export class McpAuthService {
  constructor(
    private readonly turnTokens: TurnTokenService,
    private readonly accessTokens: AccessTokenService,
    private readonly chatMessages: ChatMessageService,
    private readonly userService: UserService,
  ) {}

  async authenticate(req: Request): Promise<McpCaller> {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Missing bearer token');

    const turn = this.turnTokens.verify(token);
    if (turn) {
      // raw_input comes from the stored message, never from the caller.
      const message = await this.chatMessages.findUserTurn(
        turn.userId,
        turn.turnId,
      );
      if (!message) throw new UnauthorizedException('Unknown chat turn');

      const { ctx, weightUnit } = await this.contextFor(req, turn.userId);
      const origin: EntryOrigin = {
        source: ENTRY_SOURCE.CHAT,
        rawInput: message.text,
        sourceMessageId: message.id,
        actionGroup: `msg:${message.id}`,
      };
      return {
        ctx,
        weightUnit,
        originForCall: () => origin,
        // undo_last from chat: the user's previous turns, never this one.
        undoScope: { prefix: 'msg:', exclude: origin.actionGroup },
      };
    }

    const pat = await this.accessTokens.verify(token);
    if (pat) {
      const { ctx, weightUnit } = await this.contextFor(req, pat.userId);
      return {
        ctx,
        weightUnit,
        // Each external tool call is its own undo group.
        originForCall: () => ({
          source: ENTRY_SOURCE.MCP,
          sourceClient: pat.name,
          actionGroup: `mcp:${pat.tokenId}:${randomUUID()}`,
        }),
        // undo_last from an external client: its own earlier calls only.
        undoScope: { prefix: `mcp:${pat.tokenId}:` },
        rateLimitKey: `mcp:token:${pat.tokenId}`,
      };
    }

    throw new UnauthorizedException(
      'Invalid token: /mcp accepts a personal access token or a turn token',
    );
  }

  private async contextFor(
    req: Request,
    userId: number,
  ): Promise<{ ctx: RequestContext; weightUnit: WEIGHT_UNIT }> {
    const user = await this.userService.findById(new RequestContext(), userId);
    if (!user?.id || user.isAccountDisabled) {
      throw new UnauthorizedException('Account unavailable');
    }

    const ctx = new RequestContext();
    ctx.requestID = req.header(REQUEST_ID_TOKEN_HEADER) ?? randomUUID();
    ctx.url = req.url;
    ctx.ip = req.ip;
    ctx.user = { id: user.id, email: user.email, roles: user.roles };
    return { ctx, weightUnit: user.weightUnit };
  }
}
