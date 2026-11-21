import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ChatEvent } from '../chat/chat-api';
import { ApiError } from '../lib/api-error';
import { apiResponse, renderWithProviders } from '../test/render';
import Log from './Log';

const streamChat = vi.hoisted(() => vi.fn());
vi.mock('../chat/chat-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../chat/chat-api')>()),
  streamChat,
}));
const history = vi.hoisted(() => vi.fn());
const undo = vi.hoisted(() => vi.fn());
vi.mock('../lib/generated/chat/chat', () => ({
  chatControllerHistory: history,
  chatControllerUndo: undo,
}));
vi.mock('../lib/generated/users/users', () => ({
  userControllerGetMyProfile: vi.fn(),
  userControllerUpdateUser: vi.fn(),
}));

const ENTRY = {
  entryId: 1,
  date: '2026-11-19',
  exercise: 'Lat pulldown',
  exerciseJa: 'ラットプルダウン',
  weightUnit: 'kg',
  sets: [
    { reps: 10, weightKg: 47, weight: 47 },
    { reps: 10, weightKg: 47, weight: 47 },
  ],
  durationMin: null,
  distanceKm: null,
  speedKmh: null,
  inclinePct: null,
  estKcal: 17.4,
  kcalIsRough: true,
  dayNumber: 37,
};

const pastTurn = (
  id: number,
  text: string,
  changes: number,
  undone = false,
) => ({
  id,
  text,
  status: 'completed',
  createdAt: '2026-11-19T03:00:00.000Z',
  events: [
    { type: 'tool', name: 'log_entry', ok: true, result: ENTRY },
    { type: 'text', text: `Logged ${text}.` },
  ],
  changes,
  undone,
});

function respondWith(events: ChatEvent[]) {
  streamChat.mockImplementation(
    async (_input: unknown, onEvent: (e: ChatEvent) => void) => {
      events.forEach(onEvent);
    },
  );
}

const LOGGED: ChatEvent[] = [
  { type: 'turn', turnId: 9, replayed: false },
  { type: 'tool', name: 'log_entry', ok: true, result: ENTRY },
  { type: 'text', text: 'Logged Lat pulldown.' },
  { type: 'done', turnId: 9, changes: 1 },
];

const input = () => screen.getByLabelText('Workout');
const turns = () => screen.getAllByRole('listitem');

async function send(text: string) {
  await screen.findByText(/What did you just do|Logged/);
  await userEvent.type(input(), `${text}{Enter}`);
}

describe('Log (chat)', () => {
  beforeEach(() => {
    localStorage.clear();
    streamChat.mockReset();
    history.mockReset();
    undo.mockReset();
    history.mockResolvedValue(apiResponse({ turns: [], hasMore: false }));
  });

  test('starts with an example of what to type', async () => {
    renderWithProviders(<Log />);
    expect(await screen.findByText('What did you just do?')).toBeVisible();
    expect(input()).toHaveAttribute('placeholder', '3x10 @ 60kg squat');
  });

  test('shows earlier turns with what was saved; Undo only where changes remain', async () => {
    history.mockResolvedValue(
      apiResponse({
        turns: [pastTurn(1, 'squat', 0, true), pastTurn(2, 'pulldown', 1)],
        hasMore: false,
      }),
    );
    renderWithProviders(<Log />);

    const [first, second] = await screen.findAllByRole('listitem');
    expect(within(first).getByText('Undone')).toBeInTheDocument();
    expect(within(first).queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(within(second).getByText('Lat pulldown')).toBeInTheDocument();
    expect(within(second).getByText('2 × 10 @ 47 kg')).toBeInTheDocument();
    expect(
      within(second).getByText('Day 37 · Thu, Nov 19 · ≈ 17 kcal'),
    ).toBeInTheDocument();
    expect(within(second).getByRole('button', { name: 'Undo' })).toBeVisible();
  });

  test('sends a message and streams the card, the reply and Undo', async () => {
    respondWith(LOGGED);
    renderWithProviders(<Log />);

    await send('2x10 @ 47kg lat pulldown');

    const [turn] = turns();
    expect(within(turn).getByText('2x10 @ 47kg lat pulldown')).toBeVisible();
    expect(within(turn).getByText('2 × 10 @ 47 kg')).toBeVisible();
    expect(within(turn).getByText('Logged Lat pulldown.')).toBeVisible();
    expect(within(turn).getByRole('button', { name: 'Undo' })).toBeVisible();
    expect(streamChat).toHaveBeenCalledWith(
      {
        text: '2x10 @ 47kg lat pulldown',
        idempotencyKey: expect.stringMatching(/^[0-9a-f]{32}$/),
      },
      expect.any(Function),
    );
    expect(input()).toHaveValue('');
  });

  test('offers no Undo when the turn saved nothing', async () => {
    respondWith([
      { type: 'turn', turnId: 9, replayed: false },
      { type: 'text', text: 'You did squats on Tuesday.' },
      { type: 'done', turnId: 9, changes: 0 },
    ]);
    renderWithProviders(<Log />);
    await send('what did I do on Tuesday?');

    expect(screen.getByText('You did squats on Tuesday.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  test('Undo reverts the turn, and says when edits made since were kept', async () => {
    respondWith(LOGGED);
    undo.mockResolvedValue(
      apiResponse({
        undone: 1,
        skipped: [{ entityType: 'entry', entityId: 2, reason: 'edited' }],
      }),
    );
    renderWithProviders(<Log />);
    await send('2x10 @ 47kg lat pulldown');

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(undo).toHaveBeenCalledWith(9);
    expect(
      await screen.findByText('Undone, except 1 edited since'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  test('a dropped connection offers Retry, which resends with the same key', async () => {
    streamChat.mockImplementationOnce(
      async (_input: unknown, onEvent: (e: ChatEvent) => void) => {
        onEvent({ type: 'turn', turnId: 9, replayed: false });
        // …and the stream ends without done/error.
      },
    );
    renderWithProviders(<Log />);
    await send('2x10 @ 47kg lat pulldown');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The connection dropped before the reply finished.',
    );
    respondWith([
      { type: 'turn', turnId: 9, replayed: true },
      ...LOGGED.slice(1),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Logged Lat pulldown.')).toBeVisible();
    const [first, second] = streamChat.mock.calls;
    expect(second[0].idempotencyKey).toBe(first[0].idempotencyKey);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('explains a spending limit in the user’s language', async () => {
    localStorage.setItem('tomo.locale', 'ja');
    streamChat.mockRejectedValue(
      new ApiError('Daily budget reached', 429, 'daily_budget', 3600),
    );
    renderWithProviders(<Log />);
    await screen.findByText('今やったトレーニングは？');
    await userEvent.type(
      screen.getByLabelText('トレーニング内容'),
      'スクワット{Enter}',
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      '本日の利用上限に達しました。',
    );
  });

  test('a limit that stops a turn midway keeps its saved changes undoable', async () => {
    respondWith([
      LOGGED[0],
      LOGGED[1],
      { type: 'error', message: 'Budget', code: 'daily_budget', changes: 1 },
    ]);
    renderWithProviders(<Log />);
    await send('pulldown, then squat');

    expect(screen.getByRole('alert')).toHaveTextContent(
      "You've reached today's limit.",
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  test('Enter does not send while a Japanese IME is composing', async () => {
    renderWithProviders(<Log />);
    await screen.findByText('What did you just do?');
    const box = input();
    fireEvent.change(box, { target: { value: 'すくわっと' } });

    fireEvent.keyDown(box, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(box, { key: 'Enter', keyCode: 229 });
    expect(streamChat).not.toHaveBeenCalled();

    respondWith(LOGGED);
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(streamChat).toHaveBeenCalledTimes(1));
  });

  test('shows exercise names and dates in Japanese', async () => {
    localStorage.setItem('tomo.locale', 'ja');
    history.mockResolvedValue(
      apiResponse({ turns: [pastTurn(2, 'pulldown', 1)], hasMore: false }),
    );
    renderWithProviders(<Log />);

    expect(await screen.findByText('ラットプルダウン')).toBeVisible();
    expect(screen.getByText('37日目 · 11月19日(木) · 約17kcal')).toBeVisible();
    expect(screen.getByRole('button', { name: '取り消す' })).toBeVisible();
  });

  test('loads earlier messages on request', async () => {
    history
      .mockResolvedValueOnce(
        apiResponse({ turns: [pastTurn(5, 'newer', 0)], hasMore: true }),
      )
      .mockResolvedValueOnce(
        apiResponse({ turns: [pastTurn(3, 'older', 0)], hasMore: false }),
      );
    renderWithProviders(<Log />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Show earlier messages' }),
    );

    await waitFor(() => expect(turns()).toHaveLength(2));
    expect(history).toHaveBeenLastCalledWith({ before: 5, limit: 20 });
    expect(within(turns()[0]).getByText('older')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Show earlier messages' }),
    ).toBeNull();
  });
});
