import { useState } from 'react';

import type { MessageKey } from '../i18n/i18n';
import { useI18n } from '../i18n/i18n-context';
import { describeError } from '../lib/describe-error';
import { groupControllerRename } from '../lib/generated/groups/groups';
import type {
  GroupOutput,
  SwaggerBaseApiResponseForGroupOutput,
} from '../lib/generated/models';

const NAME_MAX = 60;

// The group's name as the page heading; the owner can rename it.
export default function GroupName({
  group,
  onChange,
}: {
  group: GroupOutput;
  onChange: (group: GroupOutput) => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('form.required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await groupControllerRename(group.id, { name: trimmed });
      onChange((res.data as SwaggerBaseApiResponseForGroupOutput).data);
      setEditing(false);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-2">
        <h1 className="min-w-0 text-2xl font-semibold break-words">
          {group.name}
        </h1>
        {group.role === 'owner' && (
          <button
            type="button"
            onClick={() => {
              setName(group.name);
              setEditing(true);
            }}
            className="text-accent min-h-11 shrink-0 cursor-pointer text-sm"
          >
            {t('groups.rename')}
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="flex flex-col gap-2"
    >
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          {t('groups.name')}
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          autoFocus
          className="border-border focus:border-accent min-h-11 w-full rounded-lg border px-3 text-base focus:outline-none"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t(error)}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-accent hover:bg-accent-hover min-h-11 cursor-pointer rounded-lg px-4 font-medium text-white disabled:opacity-50"
        >
          {t('common.save')}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="border-border min-h-11 cursor-pointer rounded-lg border px-4"
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
