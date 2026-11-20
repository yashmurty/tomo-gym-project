import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';

import { UndoResult } from '../../action-log/services/undo.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BaseApiResponse } from '../../shared/dtos/base-api-response.dto';
import { ReqContext } from '../../shared/request-context/req-context.decorator';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { ChatEvent, ChatInput } from '../dtos/chat.dto';
import { AgentService } from '../services/agent.service';

@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly agent: AgentService) {}

  @Post()
  @ApiOperation({
    summary:
      'Send a chat message; the reply streams back as server-sent events',
    description:
      'Events: turn, text, tool (one per tool call, with the result), done | error.',
  })
  @ApiProduces('text/event-stream')
  @ApiResponse({ status: HttpStatus.OK, description: 'SSE stream' })
  async send(
    @ReqContext() ctx: RequestContext,
    @Body() input: ChatInput,
    @Res() res: Response,
  ): Promise<void> {
    res.status(HttpStatus.OK).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const emit = (event: ChatEvent) =>
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    await this.agent.handleTurn(ctx, input, emit);
    res.end();
  }

  @Post('messages/:id/undo')
  @ApiOperation({ summary: 'Undo everything the agent saved for one message' })
  async undo(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BaseApiResponse<UndoResult>> {
    return { data: await this.agent.undoTurn(ctx, id), meta: {} };
  }
}
