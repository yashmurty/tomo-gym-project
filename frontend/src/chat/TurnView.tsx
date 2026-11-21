import { useI18n } from '../i18n/i18n-context';
import type { ToolEvent, TurnEvent } from './chat-api';
import EntryCard from './EntryCard';
import { dateOf, isEntryResult } from './entry-result';
import { formatDay } from './format';
import type { ChatTurn } from './useChat';

type Props = {
  turn: ChatTurn;
  onUndo: (turn: ChatTurn) => void;
  onRetry: (turn: ChatTurn) => void;
};

// One exchange: what the user typed, then what the agent saved and said.
export default function TurnView({ turn, onUndo, onRetry }: Props) {
  const { t } = useI18n();
  return (
    <li className="flex flex-col gap-2">
      <p className="bg-accent max-w-[85%] self-end rounded-2xl rounded-br-sm px-3 py-2 break-words whitespace-pre-wrap text-white">
        {turn.text}
      </p>
      <div className="flex w-full max-w-[92%] flex-col gap-2 self-start">
        {turn.events.map((event, i) => (
          <EventView key={i} event={event} />
        ))}
        {turn.phase === 'sending' && (
          <p role="status" className="text-muted text-sm">
            {t('chat.thinking')}
          </p>
        )}
        {turn.phase === 'pending' && (
          <p className="text-muted text-sm">{t('chat.stillWorking')}</p>
        )}
        {turn.error && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-x-3 text-sm text-red-700"
          >
            <span>{t(turn.error)}</span>
            {turn.retryable && (
              <button
                type="button"
                onClick={() => onRetry(turn)}
                className="text-accent min-h-11 cursor-pointer font-medium"
              >
                {t('chat.retry')}
              </button>
            )}
          </div>
        )}
        <UndoRow turn={turn} onUndo={onUndo} />
      </div>
    </li>
  );
}

function EventView({ event }: { event: TurnEvent }) {
  if (event.type === 'text') {
    return <p className="break-words whitespace-pre-wrap">{event.text}</p>;
  }
  return <ToolView event={event} />;
}

// Writes get a card or a line; reads (get_day, query_history, …) and tool
// errors show nothing: the agent's reply covers them.
function ToolView({ event }: { event: ToolEvent }) {
  const { t, locale } = useI18n();
  if (!event.ok) return null;
  const { result } = event;
  switch (event.name) {
    case 'log_entry':
    case 'update_entry':
      return isEntryResult(result) ? (
        <EntryCard entry={result} updated={event.name === 'update_entry'} />
      ) : null;
    case 'move_entries': {
      const date = dateOf(result);
      return date ? (
        <p className="text-muted text-sm">
          {t('tool.moved', { date: formatDay(date, locale) })}
        </p>
      ) : null;
    }
    case 'set_day_note': {
      const date = dateOf(result);
      return date ? (
        <p className="text-muted text-sm">
          {t('tool.noteSaved', { date: formatDay(date, locale) })}
        </p>
      ) : null;
    }
    case 'delete_entry':
      return <p className="text-muted text-sm">{t('tool.deleted')}</p>;
    default:
      return null;
  }
}

function UndoRow({ turn, onUndo }: Pick<Props, 'turn' | 'onUndo'>) {
  const { t } = useI18n();
  const { undo } = turn;

  if (undo.status === 'done') {
    const message = undo.nothing
      ? t('chat.nothingToUndo')
      : undo.skipped > 0
        ? t('chat.undoSkipped', { n: undo.skipped })
        : t('chat.undone');
    return <p className="text-muted text-sm">{message}</p>;
  }
  if (turn.changes === 0 || turn.phase === 'sending') return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3">
      <button
        type="button"
        onClick={() => onUndo(turn)}
        disabled={undo.status === 'working'}
        className="border-border min-h-11 cursor-pointer rounded-lg border px-4 text-sm disabled:opacity-50"
      >
        {undo.status === 'working' ? t('chat.undoing') : t('chat.undo')}
      </button>
      {undo.status === 'failed' && (
        <span role="alert" className="text-sm text-red-700">
          {t('chat.undoFailed')}
        </span>
      )}
    </div>
  );
}
