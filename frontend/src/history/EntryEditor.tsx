import { useState } from 'react';

import type { MessageKey } from '../i18n/i18n';
import { useI18n } from '../i18n/i18n-context';
import { ApiError } from '../lib/api-error';
import { describeError } from '../lib/describe-error';
import { entryControllerUpdate } from '../lib/generated/entries/entries';
import type { EntryOutput, UpdateEntryInput } from '../lib/generated/models';

const CARDIO = ['durationMin', 'distanceKm', 'speedKmh', 'inclinePct'] as const;
type CardioField = (typeof CARDIO)[number];

// The server's limits (workout.constant.ts LIMITS), checked here too so the
// form can point at the field. The server stays the authority.
const MAX_SETS = 50;
const RANGES: Record<CardioField, [number, number, boolean]> = {
  // [min, max, min allowed?]
  durationMin: [0, 600, false],
  distanceKm: [0, 300, false],
  speedKmh: [0, 40, false],
  inclinePct: [-15, 40, true],
};

type SetRow = { reps: string; weight: string };

// "47,5" from a keyboard that uses a decimal comma.
const parse = (value: string) => Number(value.trim().replace(',', '.'));
const blank = (value: string) => value.trim() === '';

const LABELS: Record<CardioField, MessageKey> = {
  durationMin: 'history.duration',
  distanceKm: 'history.distance',
  speedKmh: 'history.speed',
  inclinePct: 'history.incline',
};

/**
 * Edits one entry's sets and cardio numbers. Weights are shown and sent in
 * the user's unit, exactly as the server gave them (`weight`, `weightUnit`):
 * the server converts, never the app (constitution rule 9).
 */
export default function EntryEditor({
  entry,
  onSaved,
  onCancel,
}: {
  entry: EntryOutput;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const hasSets = entry.sets.length > 0;
  const showCardio = !hasSets || CARDIO.some((f) => entry[f] !== null);

  const [sets, setSets] = useState<SetRow[]>(() =>
    entry.sets.map((s) => ({
      reps: String(s.reps),
      weight: s.weight === null ? '' : String(s.weight),
    })),
  );
  const [cardio, setCardio] = useState<Record<CardioField, string>>(
    () =>
      Object.fromEntries(
        CARDIO.map((f) => [f, entry[f] === null ? '' : String(entry[f])]),
      ) as Record<CardioField, string>,
  );
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [error, setError] = useState<MessageKey | null>(null);
  const [saving, setSaving] = useState(false);

  function check(): Set<string> {
    const bad = new Set<string>();
    sets.forEach((s, i) => {
      const reps = parse(s.reps);
      if (!Number.isInteger(reps) || reps < 1 || reps > 1000) {
        bad.add(`reps-${i}`);
      }
      if (!blank(s.weight)) {
        const weight = parse(s.weight);
        if (!Number.isFinite(weight) || weight < 0) bad.add(`weight-${i}`);
      }
    });
    if (showCardio) {
      for (const f of CARDIO) {
        if (blank(cardio[f])) continue;
        const value = parse(cardio[f]);
        const [min, max, minAllowed] = RANGES[f];
        const ok =
          Number.isFinite(value) &&
          value <= max &&
          (minAllowed ? value >= min : value > min);
        if (!ok) bad.add(f);
      }
    }
    return bad;
  }

  async function save() {
    const bad = check();
    setInvalid(bad);
    if (bad.size > 0) {
      setError('history.checkFields');
      return;
    }
    const body: UpdateEntryInput = {};
    if (hasSets) {
      body.unit = entry.weightUnit;
      body.sets = sets.map((s) =>
        blank(s.weight)
          ? { reps: parse(s.reps) }
          : { reps: parse(s.reps), weight: parse(s.weight) },
      );
    }
    if (showCardio) {
      for (const f of CARDIO) {
        body[f] = blank(cardio[f]) ? null : parse(cardio[f]);
      }
    }
    setSaving(true);
    setError(null);
    try {
      await entryControllerUpdate(entry.id, body);
      onSaved();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 400
          ? 'history.checkFields'
          : describeError(err),
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass = (key: string) =>
    `min-h-11 w-full rounded-lg border px-2 text-base focus:outline-none ${
      invalid.has(key) ? 'border-red-600' : 'border-border focus:border-accent'
    }`;

  return (
    <div className="border-accent flex flex-col gap-3 rounded-xl border bg-white p-3">
      {hasSets && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">{t('history.sets')}</legend>
          <div className="text-muted grid grid-cols-[1.5rem_1fr_1fr_2.75rem] gap-2 text-xs">
            <span />
            <span>{t('history.reps')}</span>
            <span>{t('history.weight', { unit: entry.weightUnit })}</span>
          </div>
          {sets.map((s, i) => (
            <div
              key={i}
              className="grid grid-cols-[1.5rem_1fr_1fr_2.75rem] items-center gap-2"
            >
              <span className="text-muted text-sm">{i + 1}</span>
              <input
                aria-label={t('history.repsOfSet', { n: i + 1 })}
                aria-invalid={invalid.has(`reps-${i}`)}
                inputMode="numeric"
                value={s.reps}
                onChange={(e) =>
                  setSets((all) =>
                    all.map((row, j) =>
                      j === i ? { ...row, reps: e.target.value } : row,
                    ),
                  )
                }
                className={inputClass(`reps-${i}`)}
              />
              <input
                aria-label={t('history.weightOfSet', { n: i + 1 })}
                aria-invalid={invalid.has(`weight-${i}`)}
                inputMode="decimal"
                value={s.weight}
                onChange={(e) =>
                  setSets((all) =>
                    all.map((row, j) =>
                      j === i ? { ...row, weight: e.target.value } : row,
                    ),
                  )
                }
                className={inputClass(`weight-${i}`)}
              />
              {sets.length > 1 ? (
                <button
                  type="button"
                  aria-label={t('history.removeSet', { n: i + 1 })}
                  onClick={() =>
                    setSets((all) => all.filter((_, j) => j !== i))
                  }
                  className="text-muted min-h-11 cursor-pointer text-lg"
                >
                  ×
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          {sets.length < MAX_SETS && (
            <button
              type="button"
              onClick={() =>
                setSets((all) => [...all, { ...all[all.length - 1] }])
              }
              className="text-accent min-h-11 cursor-pointer self-start text-sm font-medium"
            >
              {t('history.addSet')}
            </button>
          )}
        </fieldset>
      )}

      {showCardio && (
        <div className="grid grid-cols-2 gap-2">
          {CARDIO.map((f) => (
            <label key={f} className="block">
              <span className="text-muted mb-1 block text-xs">
                {t(LABELS[f])}
              </span>
              <input
                aria-invalid={invalid.has(f)}
                inputMode="decimal"
                value={cardio[f]}
                onChange={(e) =>
                  setCardio((all) => ({ ...all, [f]: e.target.value }))
                }
                className={inputClass(f)}
              />
            </label>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t(error)}
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
          onClick={onCancel}
          className="border-border min-h-11 cursor-pointer rounded-lg border px-4"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
