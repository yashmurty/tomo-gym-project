import { useState } from 'react';

import { useI18n } from '../i18n/i18n-context';
import { dayControllerSetNote } from '../lib/generated/days/days';
import type {
  DayDetailOutput,
  SwaggerBaseApiResponseForDayDetailOutput,
} from '../lib/generated/models';

const NOTE_MAX = 500; // the server's limit

// A day's note: shown as text, edited in place. An empty note clears it.
export default function DayNote({
  day,
  onSaved,
}: {
  day: DayDetailOutput;
  onSaved: (day: DayDetailOutput) => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(day.note ?? '');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save() {
    setSaving(true);
    setFailed(false);
    try {
      const res = await dayControllerSetNote(day.date, {
        note: text.trim() || null,
      });
      onSaved((res.data as SwaggerBaseApiResponseForDayDetailOutput).data);
      setEditing(false);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        {day.note ? (
          <p className="break-words whitespace-pre-wrap">{day.note}</p>
        ) : (
          <p className="text-muted">{t('history.noNote')}</p>
        )}
        <button
          type="button"
          onClick={() => {
            setText(day.note ?? '');
            setEditing(true);
          }}
          className="text-accent min-h-11 shrink-0 cursor-pointer text-sm font-medium"
        >
          {day.note ? t('history.editNote') : t('history.addNote')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="block">
        <span className="sr-only">{t('history.note')}</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={NOTE_MAX}
          rows={3}
          className="border-border focus:border-accent w-full rounded-lg border px-3 py-2 text-base focus:outline-none"
        />
      </label>
      {failed && (
        <p role="alert" className="text-sm text-red-700">
          {t('errors.generic')}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="bg-accent hover:bg-accent-hover min-h-11 cursor-pointer rounded-lg px-4 font-medium text-white disabled:opacity-50"
        >
          {t('common.save')}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="border-border min-h-11 cursor-pointer rounded-lg border px-4"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
