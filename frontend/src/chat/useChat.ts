import { useCallback, useEffect, useState } from 'react';

import type { MessageKey } from '../i18n/i18n';
import { ApiError } from '../lib/api-error';
import { describeError, quotaMessage } from '../lib/describe-error';
import {
  chatControllerHistory,
  chatControllerUndo,
} from '../lib/generated/chat/chat';
import type {
  ChatHistoryOutput,
  ChatTurnOutput,
  SwaggerBaseApiResponseForChatHistoryOutput,
} from '../lib/generated/models';
import {
  type ChatEvent,
  fromHistoryEvent,
  newIdempotencyKey,
  streamChat,
  type TurnEvent,
} from './chat-api';

const PAGE_SIZE = 20;

export type TurnPhase =
  | 'sending' // streaming, or waiting for the stream to start
  | 'done'
  | 'failed' // finished with an error; may have saved some changes
  | 'interrupted' // the connection dropped before the turn finished
  | 'pending'; // from history: the server is still on it (or it died)

export type UndoState =
  | { status: 'idle' }
  | { status: 'working' }
  | { status: 'done'; skipped: number; nothing: boolean }
  | { status: 'failed' };

export type ChatTurn = {
  /** The idempotency key for messages sent here; `turn-<id>` from history. */
  key: string;
  /** The server's turn id, once the stream has said it. */
  id: number | null;
  text: string;
  events: TurnEvent[];
  phase: TurnPhase;
  error: MessageKey | null;
  /** Retrying is safe and useful (same key; the server replays or runs). */
  retryable: boolean;
  /** Saved changes that can still be undone. */
  changes: number;
  undo: UndoState;
};

function fromHistory(turn: ChatTurnOutput): ChatTurn {
  return {
    key: `turn-${turn.id}`,
    id: turn.id,
    text: turn.text,
    events: turn.events.map(fromHistoryEvent),
    phase:
      turn.status === 'completed'
        ? 'done'
        : turn.status === 'failed'
          ? 'failed'
          : 'pending',
    error: turn.status === 'failed' ? 'chat.failed' : null,
    retryable: false,
    changes: turn.changes,
    undo: turn.undone
      ? { status: 'done', skipped: 0, nothing: false }
      : { status: 'idle' },
  };
}

function applyEvent(turn: ChatTurn, event: ChatEvent): ChatTurn {
  switch (event.type) {
    case 'turn':
      // A retried key replays the whole turn, so start from scratch.
      return { ...turn, id: event.turnId, events: [] };
    case 'text':
    case 'tool':
      return { ...turn, events: [...turn.events, event] };
    case 'done':
      return {
        ...turn,
        phase: 'done',
        error: null,
        retryable: false,
        changes: event.changes,
      };
    case 'error':
      return {
        ...turn,
        phase: 'failed',
        error: quotaMessage(event.code) ?? 'chat.failed',
        retryable: false,
        changes: event.changes ?? 0,
      };
  }
}

async function fetchPage(before?: number): Promise<ChatHistoryOutput> {
  const res = await chatControllerHistory({ before, limit: PAGE_SIZE });
  return (res.data as SwaggerBaseApiResponseForChatHistoryOutput).data;
}

/**
 * The chat on the Log screen: history (newest page first, then older pages
 * on demand), sending with streamed replies, retry and undo.
 */
export function useChat() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const update = useCallback(
    (key: string, change: (turn: ChatTurn) => ChatTurn) =>
      setTurns((all) => all.map((t) => (t.key === key ? change(t) : t))),
    [],
  );

  const loadLatest = useCallback(async () => {
    try {
      const page = await fetchPage();
      // Keep anything sent while the history was loading.
      setTurns((live) => [
        ...page.turns
          .filter((h) => !live.some((t) => t.id === h.id))
          .map(fromHistory),
        ...live,
      ]);
      setHasMore(page.hasMore);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  const retryLoad = useCallback(() => {
    setStatus('loading');
    void loadLatest();
  }, [loadLatest]);

  const loadOlder = useCallback(async () => {
    const oldest = turns.find((t) => t.id !== null)?.id;
    if (oldest === undefined || oldest === null) return;
    setLoadingOlder(true);
    try {
      const page = await fetchPage(oldest);
      setTurns((all) => [...page.turns.map(fromHistory), ...all]);
      setHasMore(page.hasMore);
    } catch {
      // The button stays; tapping it again retries.
    } finally {
      setLoadingOlder(false);
    }
  }, [turns]);

  const run = useCallback(
    async (key: string, text: string) => {
      let started = false;
      let ended = false;
      try {
        await streamChat({ text, idempotencyKey: key }, (event) => {
          started = true;
          if (event.type === 'done' || event.type === 'error') ended = true;
          update(key, (t) => applyEvent(t, event));
        });
        if (!ended) {
          update(key, (t) => ({
            ...t,
            phase: 'interrupted',
            error: 'chat.interrupted',
            retryable: true,
          }));
        }
      } catch (err) {
        update(key, (t) => ({
          ...t,
          phase: err instanceof ApiError ? 'failed' : 'interrupted',
          error:
            err instanceof ApiError || !started
              ? describeError(err)
              : 'chat.interrupted',
          // Cut off, or refused before anything was stored (a limit, a
          // server error): the same key either runs the turn or replays it.
          // A 4xx other than 429 would only be refused again.
          retryable:
            !(err instanceof ApiError) ||
            err.status === 429 ||
            err.status >= 500,
        }));
      }
    },
    [update],
  );

  const send = useCallback(
    (text: string) => {
      const key = newIdempotencyKey();
      setTurns((all) => [
        ...all,
        {
          key,
          id: null,
          text,
          events: [],
          phase: 'sending',
          error: null,
          retryable: false,
          changes: 0,
          undo: { status: 'idle' },
        },
      ]);
      void run(key, text);
    },
    [run],
  );

  const retry = useCallback(
    (turn: ChatTurn) => {
      update(turn.key, (t) => ({
        ...t,
        phase: 'sending',
        error: null,
        retryable: false,
      }));
      void run(turn.key, turn.text);
    },
    [run, update],
  );

  const undo = useCallback(
    async (turn: ChatTurn) => {
      if (turn.id === null) return;
      update(turn.key, (t) => ({ ...t, undo: { status: 'working' } }));
      try {
        const res = await chatControllerUndo(turn.id);
        const result = (
          res.data as unknown as {
            data: { undone: number; skipped: unknown[] };
          }
        ).data;
        update(turn.key, (t) => ({
          ...t,
          changes: 0,
          undo: {
            status: 'done',
            skipped: result.skipped.length,
            nothing: result.undone === 0 && result.skipped.length === 0,
          },
        }));
      } catch {
        update(turn.key, (t) => ({ ...t, undo: { status: 'failed' } }));
      }
    },
    [update],
  );

  return {
    turns,
    status,
    hasMore,
    loadingOlder,
    busy: turns.some((t) => t.phase === 'sending'),
    send,
    retry,
    undo,
    loadOlder,
    retryLoad,
  };
}
