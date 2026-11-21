import { useState } from 'react';

import EntryCard from '../entries/EntryCard';
import { fromEntryOutput } from '../entries/entry-result';
import { useI18n } from '../i18n/i18n-context';
import { describeError } from '../lib/describe-error';
import { entryControllerRemove } from '../lib/generated/entries/entries';
import type { EntryOutput } from '../lib/generated/models';
import type { MessageKey } from '../i18n/i18n';
import EntryEditor from './EntryEditor';

// One entry on a day: the card, what was typed, and Edit / Delete.
export default function EntryItem({
  entry,
  onChanged,
}: {
  entry: EntryOutput;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'view' | 'edit' | 'confirmDelete'>('view');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  if (mode === 'edit') {
    return (
      <EntryEditor
        entry={entry}
        onSaved={() => {
          setMode('view');
          onChanged();
        }}
        onCancel={() => setMode('view')}
      />
    );
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await entryControllerRemove(entry.id);
      onChanged();
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <EntryCard entry={fromEntryOutput(entry)} showDate={false} />
      {entry.rawInput && (
        <p className="text-muted px-1 text-xs break-words">
          {t('history.typed', { text: entry.rawInput })}
        </p>
      )}
      {mode === 'confirmDelete' ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">{t('history.deleteConfirm')}</span>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="min-h-11 cursor-pointer rounded-lg bg-red-700 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {t('common.delete')}
          </button>
          <button
            type="button"
            onClick={() => setMode('view')}
            className="border-border min-h-11 cursor-pointer rounded-lg border px-4 text-sm"
          >
            {t('common.cancel')}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className="text-accent min-h-11 cursor-pointer px-1 text-sm font-medium"
          >
            {t('common.edit')}
          </button>
          <button
            type="button"
            onClick={() => setMode('confirmDelete')}
            className="min-h-11 cursor-pointer px-1 text-sm text-red-700"
          >
            {t('common.delete')}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t(error)}
        </p>
      )}
    </div>
  );
}
