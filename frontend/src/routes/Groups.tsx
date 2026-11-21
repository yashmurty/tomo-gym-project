import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { groupError, memberCountText } from '../groups/group-api';
import OwnerBadge from '../groups/OwnerBadge';
import type { MessageKey } from '../i18n/i18n';
import { useI18n } from '../i18n/i18n-context';
import {
  groupControllerCreate,
  groupControllerList,
} from '../lib/generated/groups/groups';
import type {
  GroupOutput,
  SwaggerBaseApiResponseForGroupOutput,
  SwaggerBaseApiResponseForGroupOutputArray,
} from '../lib/generated/models';

// The server's cap (GROUP_LIMITS.nameLength); it decides, this only helps.
const NAME_MAX = 60;

// Your groups, and a form to start one. Joining is by invite link only.
export default function Groups() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupOutput[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0); // bump to retry
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    let current = true;
    groupControllerList()
      .then((res) => {
        if (!current) return;
        setGroups((res.data as SwaggerBaseApiResponseForGroupOutputArray).data);
        setLoadFailed(false);
      })
      .catch(() => current && setLoadFailed(true));
    return () => {
      current = false;
    };
  }, [attempt]);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('form.required');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await groupControllerCreate({ name: trimmed });
      const group = (res.data as SwaggerBaseApiResponseForGroupOutput).data;
      navigate(`/groups/${group.id}`);
    } catch (err) {
      setError(groupError(err));
      setCreating(false);
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('groups.title')}</h1>

      {!groups && !loadFailed && (
        <p role="status" className="text-muted">
          {t('common.loading')}
        </p>
      )}
      {loadFailed && (
        <div role="alert" className="flex items-center gap-3 text-sm">
          <span className="text-red-700">{t('groups.loadFailed')}</span>
          <button
            type="button"
            onClick={() => setAttempt((a) => a + 1)}
            className="text-accent min-h-11 cursor-pointer font-medium"
          >
            {t('chat.retry')}
          </button>
        </div>
      )}
      {groups && groups.length === 0 && (
        <p className="text-muted">{t('groups.empty')}</p>
      )}
      {groups && groups.length > 0 && (
        <ul className="flex flex-col gap-2">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                to={`/groups/${group.id}`}
                className="border-border hover:border-accent flex min-h-14 items-center gap-3 rounded-xl border bg-white px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{group.name}</p>
                  <p className="text-muted text-sm">
                    {memberCountText(t, group.memberCount)}
                  </p>
                </div>
                {group.role === 'owner' && <OwnerBadge />}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
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
            placeholder={t('groups.namePlaceholder')}
            className="border-border focus:border-accent min-h-11 w-full rounded-lg border px-3 text-base focus:outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {t(error)}
          </p>
        )}
        <button
          type="submit"
          disabled={creating}
          className="bg-accent hover:bg-accent-hover min-h-11 cursor-pointer self-start rounded-lg px-4 font-medium text-white disabled:opacity-50"
        >
          {creating ? t('groups.creating') : t('groups.create')}
        </button>
      </form>
    </section>
  );
}
