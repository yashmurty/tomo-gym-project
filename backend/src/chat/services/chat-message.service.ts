import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import {
  CHAT_ROLE,
  ChatMessage,
  TURN_STATUS,
} from '../entities/chat-message.entity';

// Persistence for the chat transcript. No ACL here: every method is scoped
// by an explicit userId supplied by trusted callers (the agent loop, which
// takes it from the JWT, and /mcp, which takes it from a verified turn
// token). Nothing here is exposed over HTTP directly.
@Injectable()
export class ChatMessageService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly messages: Repository<ChatMessage>,
  ) {}

  findTurnByIdempotencyKey(
    userId: number,
    key: string,
  ): Promise<ChatMessage | null> {
    return this.messages.findOneBy({
      userId,
      idempotencyKey: key,
      role: CHAT_ROLE.USER,
    });
  }

  // The user message that started a turn, if it belongs to this user.
  findUserTurn(userId: number, turnId: number): Promise<ChatMessage | null> {
    return this.messages.findOneBy({
      id: turnId,
      userId,
      role: CHAT_ROLE.USER,
    });
  }

  startTurn(
    userId: number,
    text: string,
    idempotencyKey: string,
  ): Promise<ChatMessage> {
    return this.messages.save(
      this.messages.create({
        userId,
        turnId: null,
        role: CHAT_ROLE.USER,
        content: text,
        text,
        idempotencyKey,
        status: TURN_STATUS.PENDING,
      }),
    );
  }

  append(
    userId: number,
    turnId: number,
    role: CHAT_ROLE.ASSISTANT | CHAT_ROLE.TOOL_RESULT,
    content: unknown,
    text: string | null,
  ): Promise<ChatMessage> {
    return this.messages.save(
      this.messages.create({ userId, turnId, role, content, text }),
    );
  }

  async finishTurn(turnId: number, status: TURN_STATUS): Promise<void> {
    await this.messages.update(turnId, { status });
  }

  // Messages of the turn (excluding the user message itself), oldest first.
  turnMessages(turnId: number): Promise<ChatMessage[]> {
    return this.messages.find({ where: { turnId }, order: { id: 'ASC' } });
  }

  // The last `limit` completed turns, oldest first, with all their messages.
  async recentHistory(userId: number, limit: number): Promise<ChatMessage[]> {
    const turns = await this.messages.find({
      where: { userId, role: CHAT_ROLE.USER, status: TURN_STATUS.COMPLETED },
      order: { id: 'DESC' },
      take: limit,
    });
    if (turns.length === 0) return [];

    const turnIds = turns.map((t) => t.id);
    const rest = await this.messages.find({
      where: { turnId: In(turnIds) },
      order: { id: 'ASC' },
    });
    return [...turns, ...rest].sort((a, b) => a.id - b.id);
  }
}
