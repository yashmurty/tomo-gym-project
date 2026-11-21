import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { isNotFound } from '../groups/group-api';
import GroupName from '../groups/GroupName';
import InviteCard from '../groups/InviteCard';
import MemberList from '../groups/MemberList';
import type { MessageKey } from '../i18n/i18n';
import { useI18n } from '../i18n/i18n-context';
import { describeError } from '../lib/describe-error';
import {
  groupControllerDelete,
  groupControllerGet,
} from '../lib/generated/groups/groups';
import type {
  GroupOutput,
  SwaggerBaseApiResponseForGroupOutput,
} from '../lib/generated/models';

// One group: its name, invite link and members. The feed (12c) and the
// leaderboard (12d) come later.
export default function GroupPage() {
  const { t } = useI18n();
  const { id = '' } = useParams();
  const groupId = Number(id);
  const validId = Number.isInteger(groupId) && groupId > 0;
  const [group, setGroup] = useState<GroupOutput | null>(null);
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'notFound' | 'error'
  >(validId ? 'loading' : 'notFound');

  useEffect(() => {
    if (!validId) return;
    let current = true;
    groupControllerGet(groupId)
      .then((res) => {
        if (!current) return;
        setGroup((res.data as SwaggerBaseApiResponseForGroupOutput).data);
        setStatus('ready');
      })
      .catch((err) => {
        // Not a member and no such group look the same: a 404.
        if (current) setStatus(isNotFound(err) ? 'notFound' : 'error');
      });
    return () => {
      current = false;
    };
  }, [groupId, validId]);

  return (
    <section className="flex flex-col gap-6">
      <Link
        to="/groups"
        className="text-accent -my-2 inline-flex min-h-11 items-center self-start text-sm"
      >
        ‹ {t('groups.back')}
      </Link>

      {status === 'loading' && (
        <p role="status" className="text-muted">
          {t('common.loading')}
        </p>
      )}
      {status === 'notFound' && (
        <p role="alert" className="text-muted">
          {t('groups.notFound')}
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="text-red-700">
          {t('groups.groupLoadFailed')}
        </p>
      )}

      {group && (
        <>
          <GroupName group={group} onChange={setGroup} />
          <InviteCard group={group} onChange={setGroup} />
          <MemberList groupId={group.id} />
          {group.role === 'owner' && <DeleteGroup group={group} />}
        </>
      )}
    </section>
  );
}

function DeleteGroup({ group }: { group: GroupOutput }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await groupControllerDelete(group.id);
      navigate('/groups', { replace: true });
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-11 cursor-pointer self-start text-sm text-red-700"
        >
          {t('groups.delete')}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">
            {t('groups.deleteConfirm', { name: group.name })}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="min-h-11 cursor-pointer rounded-lg bg-red-700 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {t('groups.delete')}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="border-border min-h-11 cursor-pointer rounded-lg border px-4 text-sm"
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
    </div>
  );
}
