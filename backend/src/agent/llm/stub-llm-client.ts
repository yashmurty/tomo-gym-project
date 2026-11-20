import type {
  ContentBlockParam,
  MessageParam,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/messages';

import { LlmClient, LlmRequest, LlmResponse } from './llm-client';

// A deterministic stand-in for Claude, used until an Anthropic API key is
// configured (LLM_PROVIDER=stub). It behaves like the real loop expects:
// a parseable workout message → a `log_entry` tool_use; a tool result → a
// one-line confirmation. It understands only the simplest formats, which is
// enough to exercise the whole pipe. It is NOT the product's parser.
//
//   "2x10 @ 47kg lat pulldown" / "lat pulldown 2 x 10 @ 47 kg"
//   "10 min walk speed 6 incline 2"
export class StubLlmClient implements LlmClient {
  private nextId = 1;

  async createMessage(request: LlmRequest): Promise<LlmResponse> {
    const last = request.messages[request.messages.length - 1];
    const toolResults = blocksOf(last).filter(
      (b): b is ToolResultBlockParam => b.type === 'tool_result',
    );

    const content: LlmResponse['content'] = toolResults.length
      ? [{ type: 'text', text: toolResults.map(confirmation).join(' ') }]
      : this.respondTo(lastUserText(last));

    return {
      model: 'stub',
      content,
      stopReason: content.some((b) => b.type === 'tool_use')
        ? 'tool_use'
        : 'end_turn',
      usage: {
        inputTokens: Math.ceil(JSON.stringify(request).length / 4),
        outputTokens: Math.ceil(JSON.stringify(content).length / 4),
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    };
  }

  private respondTo(text: string): LlmResponse['content'] {
    const input = parseWorkout(text);
    if (!input) {
      return [
        {
          type: 'text',
          text: 'I couldn\'t read that as a workout (stub model: try "2x10 @ 47kg lat pulldown").',
        },
      ];
    }
    return [
      {
        type: 'tool_use',
        id: `toolu_stub_${this.nextId++}`,
        name: 'log_entry',
        input,
      },
    ];
  }
}

const STRENGTH =
  /^(?:(.+?)\s+)?(\d+)\s*[x×*]\s*(\d+)\s*@\s*(\d+(?:\.\d+)?)\s*(kgs?|lg|lbs?)?\s*(.*)$/i;
const CARDIO =
  /^(\d+(?:\.\d+)?)\s*min(?:utes)?\s+(.+?)(?:\s+speed\s+(\d+(?:\.\d+)?))?(?:\s+incline\s+(\d+(?:\.\d+)?))?$/i;

export function parseWorkout(text: string): Record<string, unknown> | null {
  const t = text.trim();

  const s = STRENGTH.exec(t);
  if (s) {
    const exercise = (s[1] || s[6] || '').trim();
    if (!exercise) return null;
    const sets = Number(s[2]);
    const reps = Number(s[3]);
    const weight = Number(s[4]);
    const unit = /^lb/i.test(s[5] ?? '') ? 'lb' : 'kg'; // "lg" is a kg typo
    return {
      exercise,
      date: 'today',
      unit,
      sets: Array.from({ length: sets }, () => ({ reps, weight })),
    };
  }

  const c = CARDIO.exec(t);
  if (c) {
    return {
      exercise: c[2].trim(),
      date: 'today',
      durationMin: Number(c[1]),
      ...(c[3] ? { speedKmh: Number(c[3]) } : {}),
      ...(c[4] ? { inclinePct: Number(c[4]) } : {}),
    };
  }
  return null;
}

function blocksOf(message: MessageParam | undefined): ContentBlockParam[] {
  if (!message) return [];
  return typeof message.content === 'string'
    ? [{ type: 'text', text: message.content }]
    : message.content;
}

// The user's own words: the last text block (the context block comes first).
function lastUserText(message: MessageParam | undefined): string {
  const texts = blocksOf(message).filter(
    (b): b is { type: 'text'; text: string } => b.type === 'text',
  );
  return texts.length ? texts[texts.length - 1].text : '';
}

function confirmation(result: ToolResultBlockParam): string {
  const raw = typeof result.content === 'string' ? result.content : '';
  if (result.is_error) return `Couldn't log that: ${raw}`;
  try {
    const r = JSON.parse(raw);
    const what = r.sets?.length
      ? `${r.sets.length}×${r.sets[0].reps}${r.sets[0].weightKg !== null ? ` @ ${r.sets[0].weightKg} kg` : ''}`
      : `${r.durationMin} min`;
    return `Logged ${r.exercise}: ${what} · ${r.date} · Day ${r.dayNumber}.`;
  } catch {
    return 'Logged.';
  }
}
