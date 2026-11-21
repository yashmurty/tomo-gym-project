import { useEffect } from 'react';

import Composer from '../chat/Composer';
import TurnView from '../chat/TurnView';
import { useChat } from '../chat/useChat';
import { useI18n } from '../i18n/i18n-context';

// The chat logger: type a workout, see what was saved, undo it.
export default function Log() {
  const { t } = useI18n();
  const chat = useChat();
  // Follow new content at the end (not older pages loaded at the top).
  // Scroll the page to its very bottom: the spacer below plus the layout's
  // padding keep the last message clear of the composer and the tab bar.
  const last = chat.turns[chat.turns.length - 1];
  const lastChange = last
    ? `${last.key}:${last.events.length}:${last.phase}:${last.undo.status}`
    : '';
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [lastChange]);

  return (
    <section className="flex flex-1 flex-col">
      <h1 className="sr-only">{t('log.title')}</h1>

      {chat.hasMore && (
        <button
          type="button"
          onClick={() => void chat.loadOlder()}
          disabled={chat.loadingOlder}
          className="text-accent mb-4 min-h-11 cursor-pointer self-center text-sm disabled:opacity-50"
        >
          {chat.loadingOlder ? t('common.loading') : t('chat.loadEarlier')}
        </button>
      )}

      {chat.status === 'loading' && (
        <p role="status" className="text-muted text-sm">
          {t('common.loading')}
        </p>
      )}
      {chat.status === 'error' && (
        <div role="alert" className="flex items-center gap-3 text-sm">
          <span className="text-red-700">{t('chat.loadFailed')}</span>
          <button
            type="button"
            onClick={chat.retryLoad}
            className="text-accent min-h-11 cursor-pointer font-medium"
          >
            {t('chat.retry')}
          </button>
        </div>
      )}

      {chat.status === 'ready' && chat.turns.length === 0 && (
        <div className="flex flex-1 flex-col justify-center gap-2 py-10">
          <p className="text-xl font-semibold">{t('chat.emptyTitle')}</p>
          <p className="text-muted">{t('chat.emptyHint')}</p>
        </div>
      )}

      <ol className="flex flex-col gap-5">
        {chat.turns.map((turn) => (
          <TurnView
            key={turn.key}
            turn={turn}
            onUndo={(t) => void chat.undo(t)}
            onRetry={chat.retry}
          />
        ))}
      </ol>

      {/* Room for the composer above the tab bar. */}
      <div className="h-20 shrink-0" />

      <Composer
        onSend={chat.send}
        disabled={chat.status === 'loading' || chat.busy}
      />
    </section>
  );
}
