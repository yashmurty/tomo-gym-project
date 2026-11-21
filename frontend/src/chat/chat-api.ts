import { authorizedFetch } from '../lib/api-client';
import { toApiError } from '../lib/api-error';
import type { ChatTurnEventOutput } from '../lib/generated/models';

// The events of one chat turn, as POST /chat streams them (server-sent
// events) and GET /chat/messages returns them. Mirrors ChatEvent in the
// backend's agent/dtos/chat.dto.ts; SSE isn't described by Swagger, so
// these aren't generated.
export type TextEvent = { type: 'text'; text: string };
export type ToolEvent = {
  type: 'tool';
  name: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};
export type TurnEvent = TextEvent | ToolEvent;
export type ChatEvent =
  | { type: 'turn'; turnId: number; replayed: boolean }
  | TurnEvent
  | { type: 'done'; turnId: number; changes: number }
  | { type: 'error'; message: string; code?: string; changes?: number };

/**
 * Sends one message and calls `onEvent` for each event as it arrives.
 * Resolves when the stream ends; the last event is `done` or `error` unless
 * the connection dropped first. Throws ApiError when the server refuses the
 * message before streaming (e.g. a 429 limit), and the fetch error when
 * the network fails.
 *
 * Retrying with the same idempotency key is always safe: the server replays
 * a stored turn instead of running it again (constitution rule 11).
 */
export async function streamChat(
  input: { text: string; idempotencyKey: string },
  onEvent: (event: ChatEvent) => void,
): Promise<void> {
  const response = await authorizedFetch('/api/v1/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await toApiError(response);
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (data) onEvent(JSON.parse(data) as ChatEvent);
    }
  }
}

// A history event (Swagger-typed, all fields optional) as a TurnEvent.
export function fromHistoryEvent(event: ChatTurnEventOutput): TurnEvent {
  if (event.type === 'text') return { type: 'text', text: event.text ?? '' };
  return {
    type: 'tool',
    name: event.name ?? '',
    ok: event.ok === true,
    result: event.result,
    error: event.error,
  };
}

// Unique per message (the server's rule: 8–64 of A–Z a–z 0–9 _ -). Uses
// getRandomValues, not randomUUID, which needs a secure context and so
// fails when testing on a phone over the LAN (http://192.168…).
export function newIdempotencyKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
