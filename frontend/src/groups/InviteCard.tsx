import { useState } from 'react';

import CopyField from '../components/CopyField';
import type { MessageKey } from '../i18n/i18n';
import { useI18n } from '../i18n/i18n-context';
import { inviteUrl } from '../lib/config';
import { describeError } from '../lib/describe-error';
import {
  groupControllerResetInvite,
  groupControllerSetInvite,
} from '../lib/generated/groups/groups';
import type {
  GroupOutput,
  SwaggerBaseApiResponseForGroupOutput,
} from '../lib/generated/models';

// The invite link: any member can copy it; only the owner can reset it (the
// old link stops working) or turn it off and on (on again brings back the
// same link).
export default function InviteCard({
  group,
  onChange,
}: {
  group: GroupOutput;
  onChange: (group: GroupOutput) => void;
}) {
  const { t } = useI18n();
  const isOwner = group.role === 'owner';
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  async function run(call: () => Promise<{ data: unknown }>) {
    setBusy(true);
    setError(null);
    try {
      const res = await call();
      onChange((res.data as SwaggerBaseApiResponseForGroupOutput).data);
      setConfirmingReset(false);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  const buttonClass =
    'border-border min-h-11 cursor-pointer rounded-lg border px-4 text-sm disabled:opacity-50';

  return (
    <section className="border-border flex flex-col gap-3 rounded-xl border bg-white p-3">
      <h2 className="font-semibold">{t('invite.title')}</h2>

      {group.inviteEnabled && group.inviteToken ? (
        <>
          <p className="text-sm">{t('invite.hint')}</p>
          <CopyField
            label={t('invite.title')}
            value={inviteUrl(group.inviteToken)}
          />
        </>
      ) : (
        <p className="text-muted text-sm">{t('invite.off')}</p>
      )}

      {isOwner && !confirmingReset && (
        <div className="flex flex-wrap gap-2">
          {group.inviteEnabled && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmingReset(true)}
              className={buttonClass}
            >
              {t('invite.reset')}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(() =>
                groupControllerSetInvite(group.id, {
                  enabled: !group.inviteEnabled,
                }),
              )
            }
            className={buttonClass}
          >
            {group.inviteEnabled ? t('invite.turnOff') : t('invite.turnOn')}
          </button>
        </div>
      )}

      {isOwner && confirmingReset && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">{t('invite.resetConfirm')}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => groupControllerResetInvite(group.id))}
            className="min-h-11 cursor-pointer rounded-lg bg-red-700 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {t('invite.reset')}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingReset(false)}
            className={buttonClass}
          >
            {t('common.cancel')}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {t(error)}
        </p>
      )}
    </section>
  );
}
