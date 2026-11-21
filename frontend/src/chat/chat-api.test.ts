import { ApiError } from '../lib/api-error';
import {
  type ChatEvent,
  fromHistoryEvent,
  newIdempotencyKey,
  streamChat,
} from './chat-api';

const fetchMock = vi.fn<typeof fetch>();

// A streamed response whose chunks split frames at awkward places.
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('streamChat', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('accessToken', 'access');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  test('parses events as they arrive, across chunk boundaries', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'event: turn\ndata: {"type":"turn","turnId":5,"replayed":false}\n\nevent: te',
        'xt\ndata: {"type":"text","text":"Logged."}\r\n\r\n',
        'event: done\ndata: {"type":"done","turnId":5,"changes":1}\n\n',
      ]),
    );
    const events: ChatEvent[] = [];

    await streamChat({ text: 'squat', idempotencyKey: 'key-12345' }, (e) =>
      events.push(e),
    );

    expect(events).toEqual([
      { type: 'turn', turnId: 5, replayed: false },
      { type: 'text', text: 'Logged.' },
      { type: 'done', turnId: 5, changes: 1 },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/v1/chat');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer access' });
    expect(JSON.parse(String(init?.body))).toEqual({
      text: 'squat',
      idempotencyKey: 'key-12345',
    });
  });

  test('a limit before streaming throws ApiError with the code and Retry-After', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: 'Daily budget reached',
            details: { code: 'daily_budget' },
          },
        }),
        { status: 429, headers: { 'Retry-After': '3600' } },
      ),
    );

    const err = await streamChat(
      { text: 'squat', idempotencyKey: 'key-12345' },
      () => {},
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 429,
      code: 'daily_budget',
      retryAfterSec: 3600,
    });
  });
});

describe('fromHistoryEvent', () => {
  test('turns Swagger-typed history events into stream events', () => {
    expect(fromHistoryEvent({ type: 'text', text: 'Hi' })).toEqual({
      type: 'text',
      text: 'Hi',
    });
    expect(
      fromHistoryEvent({ type: 'tool', name: 'get_day', ok: true, result: {} }),
    ).toEqual({
      type: 'tool',
      name: 'get_day',
      ok: true,
      result: {},
      error: undefined,
    });
  });
});

test("idempotency keys match the server's format and don't repeat", () => {
  const a = newIdempotencyKey();
  expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  expect(newIdempotencyKey()).not.toBe(a);
});
