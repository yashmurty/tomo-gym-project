import {
  CHAT_ROLE,
  ChatMessage,
} from '../../chat/entities/chat-message.entity';
import { LOCALE } from '../../shared/constants/locale.constant';
import { WEIGHT_UNIT } from '../../shared/units/weight';
import { UserOutput } from '../../user/dtos/user-output.dto';
import { toMessageParams } from './agent.service';
import { contextBlock, SYSTEM_PROMPT } from './system-prompt';

describe('agent helpers', () => {
  const message = (role: CHAT_ROLE, content: unknown): ChatMessage =>
    ({ role, content }) as ChatMessage;

  describe('toMessageParams', () => {
    it('maps roles and keeps a normal turn as-is', () => {
      const params = toMessageParams([
        message(CHAT_ROLE.USER, '2x10 @ 47kg lat pulldown'),
        message(CHAT_ROLE.ASSISTANT, [
          { type: 'tool_use', id: 't1', name: 'log_entry', input: {} },
        ]),
        message(CHAT_ROLE.TOOL_RESULT, [
          { type: 'tool_result', tool_use_id: 't1', content: '{}' },
        ]),
        message(CHAT_ROLE.ASSISTANT, [{ type: 'text', text: 'Logged.' }]),
      ]);
      expect(params.map((p) => p.role)).toEqual([
        'user',
        'assistant',
        'user',
        'assistant',
      ]);
      expect(params[0].content).toEqual([
        { type: 'text', text: '2x10 @ 47kg lat pulldown' },
      ]);
    });

    it('merges consecutive same-role messages, tool results first', () => {
      const params = toMessageParams([
        message(CHAT_ROLE.TOOL_RESULT, [
          { type: 'tool_result', tool_use_id: 't1', content: '{}' },
        ]),
        message(CHAT_ROLE.USER, 'next message'),
      ]);
      expect(params).toHaveLength(1);
      expect(params[0].content).toEqual([
        { type: 'tool_result', tool_use_id: 't1', content: '{}' },
        { type: 'text', text: 'next message' },
      ]);
    });
  });

  describe('contextBlock', () => {
    const user = {
      timezone: 'Asia/Tokyo',
      weightUnit: WEIGHT_UNIT.KG,
      weightKg: 72,
      locale: LOCALE.JA,
    } as UserOutput;

    it("states now, the user's local date and time, and reply language", () => {
      // 15:30 UTC = 00:30 next day in Tokyo.
      const block = contextBlock(user, new Date('2026-11-19T15:30:00Z'));
      expect(block).toContain('now_utc: 2026-11-19T15:30:00.000Z');
      expect(block).toContain('timezone: Asia/Tokyo');
      expect(block).toContain('today: 2026-11-20');
      expect(block).toContain('local_time: 00:30');
      expect(block).toContain('reply_language: ja');
    });

    it('keeps per-request facts out of the cached system prompt', () => {
      expect(SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(SYSTEM_PROMPT).toContain(
        'Never take a date from earlier messages',
      );
    });
  });
});
