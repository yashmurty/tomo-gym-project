import { useEffect, useState } from 'react';

import CopyField from '../components/CopyField';
import type { Locale, MessageKey } from '../i18n/i18n';
import { useI18n } from '../i18n/i18n-context';
import { mcpServerUrl } from '../lib/config';
import { describeError } from '../lib/describe-error';
import {
  accessTokenControllerCreate,
  accessTokenControllerList,
  accessTokenControllerRevoke,
} from '../lib/generated/personal-access-tokens/personal-access-tokens';
import type {
  AccessTokenOutput,
  SwaggerBaseApiResponseForAccessTokenOutputArray,
  SwaggerBaseApiResponseForCreatedAccessTokenOutput,
} from '../lib/generated/models';

const formatDate = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en', {
    dateStyle: 'medium',
  }).format(new Date(iso));

/**
 * Personal access tokens for external MCP clients (constitution rule 5).
 * The token itself is shown once, right after it's created; the list only
 * ever has its prefix.
 */
export default function AccessTokens() {
  const { t, locale } = useI18n();
  const [tokens, setTokens] = useState<AccessTokenOutput[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [version, setVersion] = useState(0); // bump to reload the list

  useEffect(() => {
    let current = true;
    accessTokenControllerList()
      .then((res) => {
        if (!current) return;
        setTokens(
          (res.data as SwaggerBaseApiResponseForAccessTokenOutputArray).data,
        );
        setLoadFailed(false);
      })
      .catch(() => current && setLoadFailed(true));
    return () => {
      current = false;
    };
  }, [version]);
  const reload = () => setVersion((v) => v + 1);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('form.required');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await accessTokenControllerCreate({ name: trimmed });
      const body = (
        res.data as SwaggerBaseApiResponseForCreatedAccessTokenOutput
      ).data;
      setCreated(body.token);
      setName('');
      reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: number) {
    setError(null);
    try {
      await accessTokenControllerRevoke(id);
      setConfirming(null);
      reload();
    } catch (err) {
      setError(describeError(err));
    }
  }

  const url = mcpServerUrl();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">{t('tokens.intro')}</p>
      <CopyField label={t('tokens.serverUrl')} value={url} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
        className="flex flex-col gap-2"
      >
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            {t('tokens.name')}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder={t('tokens.namePlaceholder')}
            className="border-border focus:border-accent min-h-11 w-full rounded-lg border px-3 text-base focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={creating}
          className="bg-accent hover:bg-accent-hover min-h-11 cursor-pointer self-start rounded-lg px-4 font-medium text-white disabled:opacity-50"
        >
          {creating ? t('tokens.creating') : t('tokens.create')}
        </button>
      </form>

      {created && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3"
        >
          <p className="font-medium">{t('tokens.newToken')}</p>
          <CopyField label={t('tokens.newToken')} value={created} />
          <p className="text-sm">{t('tokens.copyNow')}</p>
          <p className="text-sm">{t('tokens.example')}</p>
          <pre className="overflow-x-auto rounded-lg bg-white p-2 text-xs">
            {`claude mcp add --transport http tomo-gym ${url} \\\n  --header "Authorization: Bearer ${created}"`}
          </pre>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t(error)}
        </p>
      )}
      {loadFailed && (
        <p role="alert" className="text-sm text-red-700">
          {t('tokens.loadFailed')}
        </p>
      )}

      {tokens && tokens.length === 0 && (
        <p className="text-muted text-sm">{t('tokens.none')}</p>
      )}
      {tokens && tokens.length > 0 && (
        <ul className="flex flex-col gap-2">
          {tokens.map((token) => (
            <li
              key={token.id}
              className="border-border flex flex-col gap-1 rounded-xl border bg-white px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium">
                  {token.name}
                </span>
                {confirming !== token.id && (
                  <button
                    type="button"
                    onClick={() => setConfirming(token.id)}
                    className="min-h-11 shrink-0 cursor-pointer text-sm text-red-700"
                  >
                    {t('tokens.revoke')}
                  </button>
                )}
              </div>
              <p className="text-muted text-xs">
                <span className="font-mono">{token.tokenPrefix}…</span>
                {' · '}
                {token.lastUsedAt
                  ? t('tokens.lastUsed', {
                      date: formatDate(token.lastUsedAt, locale),
                    })
                  : t('tokens.neverUsed')}
                {' · '}
                {t('tokens.created', {
                  date: formatDate(token.createdAt, locale),
                })}
              </p>
              {confirming === token.id && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">
                    {t('tokens.revokeConfirm', { name: token.name })}
                  </span>
                  <button
                    type="button"
                    onClick={() => void revoke(token.id)}
                    className="min-h-11 cursor-pointer rounded-lg bg-red-700 px-4 text-sm font-medium text-white"
                  >
                    {t('tokens.revoke')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="border-border min-h-11 cursor-pointer rounded-lg border px-4 text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
