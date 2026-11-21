import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { groupError, isNotFound, memberCountText } from '../groups/group-api';
import type { MessageKey } from '../i18n/i18n';
import { useI18n } from '../i18n/i18n-context';
import {
  inviteControllerJoin,
  inviteControllerPreview,
} from '../lib/generated/invites/invites';
import type {
  InvitePreviewOutput,
  SwaggerBaseApiResponseForGroupOutput,
  SwaggerBaseApiResponseForInvitePreviewOutput,
} from '../lib/generated/models';

// Where an invite link lands (behind sign-in; a new user signs up and comes
// back here). A link that's unknown, reset or off says so without naming
// the group.
export default function Join() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { token = '' } = useParams();
  const [preview, setPreview] = useState<InvitePreviewOutput | null>(null);
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'inactive' | 'error'
  >('loading');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    let current = true;
    inviteControllerPreview(token)
      .then((res) => {
        if (!current) return;
        setPreview(
          (res.data as SwaggerBaseApiResponseForInvitePreviewOutput).data,
        );
        setStatus('ready');
      })
      .catch((err) => {
        if (current) setStatus(isNotFound(err) ? 'inactive' : 'error');
      });
    return () => {
      current = false;
    };
  }, [token]);

  async function join() {
    setJoining(true);
    setError(null);
    try {
      const res = await inviteControllerJoin(token);
      const group = (res.data as SwaggerBaseApiResponseForGroupOutput).data;
      navigate(`/groups/${group.id}`, { replace: true });
    } catch (err) {
      // Reset or turned off since the page loaded.
      if (isNotFound(err)) setStatus('inactive');
      else setError(groupError(err));
      setJoining(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {status === 'loading' && (
        <p role="status" className="text-muted">
          {t('common.loading')}
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="text-red-700">
          {t('join.loadFailed')}
        </p>
      )}
      {status === 'inactive' && (
        <>
          <p role="alert">{t('join.inactive')}</p>
          <GroupsLink />
        </>
      )}

      {status === 'ready' && preview && preview.alreadyMember && (
        <>
          <p>{t('join.already', { name: preview.name })}</p>
          <Link
            to={`/groups/${preview.groupId}`}
            className="bg-accent hover:bg-accent-hover flex min-h-12 items-center justify-center rounded-lg px-4 font-medium text-white"
          >
            {t('join.open')}
          </Link>
        </>
      )}

      {status === 'ready' && preview && !preview.alreadyMember && (
        <>
          <h1 className="text-2xl font-semibold break-words">
            {t('join.title', { name: preview.name })}
          </h1>
          <p className="text-muted">
            {memberCountText(t, preview.memberCount)}
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {t(error)}
            </p>
          )}
          <button
            type="button"
            disabled={joining}
            onClick={() => void join()}
            className="bg-accent hover:bg-accent-hover min-h-12 w-full cursor-pointer rounded-lg px-4 font-medium text-white disabled:opacity-50"
          >
            {joining ? t('join.joining') : t('join.submit')}
          </button>
        </>
      )}
    </section>
  );
}

function GroupsLink() {
  const { t } = useI18n();
  return (
    <Link
      to="/groups"
      className="text-accent inline-flex min-h-11 items-center self-start text-sm"
    >
      ‹ {t('groups.back')}
    </Link>
  );
}
