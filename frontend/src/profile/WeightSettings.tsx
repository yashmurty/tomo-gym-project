import { useId, useState } from 'react';

import type { MessageKey } from '../i18n/i18n';
import { useI18n } from '../i18n/i18n-context';
import { ApiError } from '../lib/api-error';
import { useAuth } from '../lib/auth-context';
import { describeError } from '../lib/describe-error';
import type { UserOutput } from '../lib/generated/models';

const UNITS = ['kg', 'lb'] as const;

// Display unit and body weight. The weight is shown and sent in the user's
// unit (`weight`); the server stores kg and range-checks it (rule 9).
export default function WeightSettings({ profile }: { profile: UserOutput }) {
  const { t } = useI18n();
  const { updateProfile } = useAuth();
  const [error, setError] = useState<MessageKey | null>(null);

  async function save(input: Parameters<typeof updateProfile>[0]) {
    setError(null);
    try {
      await updateProfile(input);
      return true;
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 400
          ? 'profile.weightInvalid'
          : describeError(err),
      );
      return false;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-1 font-medium">{t('profile.weightUnit')}</legend>
        <div
          role="group"
          className="border-border flex w-fit overflow-hidden rounded-full border"
        >
          {UNITS.map((unit) => (
            <button
              key={unit}
              type="button"
              aria-pressed={profile.weightUnit === unit}
              onClick={() =>
                unit !== profile.weightUnit && void save({ weightUnit: unit })
              }
              className={`min-h-11 cursor-pointer px-5 ${
                profile.weightUnit === unit
                  ? 'bg-foreground text-white'
                  : 'text-muted'
              }`}
            >
              {unit}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Remounts when the saved value or unit changes, so it shows them. */}
      <BodyWeightForm
        key={`${profile.weightUnit}:${profile.weight}`}
        profile={profile}
        onSave={save}
      />

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t(error)}
        </p>
      )}
    </div>
  );
}

function BodyWeightForm({
  profile,
  onSave,
}: {
  profile: UserOutput;
  onSave: (input: { weight: number | null }) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const id = useId();
  const saved = profile.weight === null ? '' : String(profile.weight);
  const [value, setValue] = useState(saved);
  const [busy, setBusy] = useState(false);
  const trimmed = value.trim().replace(',', '.');
  const valid = trimmed === '' || Number(trimmed) > 0;

  async function submit() {
    if (!valid) return;
    setBusy(true);
    await onSave({ weight: trimmed === '' ? null : Number(trimmed) });
    setBusy(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {/* Only the label names the input (the unit is in it for screen
          readers, and shown beside the field for everyone else). */}
      <label htmlFor={id} className="mb-1 block font-medium">
        {t('profile.bodyWeight')}
        <span className="sr-only"> ({profile.weightUnit})</span>
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="decimal"
          aria-invalid={!valid}
          className="border-border focus:border-accent min-h-11 w-28 rounded-lg border px-3 text-base focus:outline-none"
        />
        <span aria-hidden="true" className="text-muted">
          {profile.weightUnit}
        </span>
        <button
          type="submit"
          disabled={busy || !valid || value === saved}
          className="bg-accent hover:bg-accent-hover min-h-11 cursor-pointer rounded-lg px-4 font-medium text-white disabled:opacity-50"
        >
          {t('common.save')}
        </button>
      </div>
      <p className="text-muted mt-1 text-sm">{t('register.weightHint')}</p>
    </form>
  );
}
