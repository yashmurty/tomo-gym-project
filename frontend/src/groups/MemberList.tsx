import { useEffect, useState } from 'react';

import { useI18n } from '../i18n/i18n-context';
import { useAuth } from '../lib/auth-context';
import { groupControllerMembers } from '../lib/generated/groups/groups';
import type {
  GroupMemberOutput,
  SwaggerBaseApiResponseForGroupMemberOutputArray,
} from '../lib/generated/models';
import OwnerBadge from './OwnerBadge';

// Members by display name (never email), owner first, as the server sends
// them. Managing members (remove, leave, hand over) is Step 12b.
export default function MemberList({ groupId }: { groupId: number }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [members, setMembers] = useState<GroupMemberOutput[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let current = true;
    groupControllerMembers(groupId)
      .then((res) => {
        if (!current) return;
        setMembers(
          (res.data as SwaggerBaseApiResponseForGroupMemberOutputArray).data,
        );
      })
      .catch(() => current && setLoadFailed(true));
    return () => {
      current = false;
    };
  }, [groupId]);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t('groups.members')}</h2>
      {loadFailed && (
        <p role="alert" className="text-sm text-red-700">
          {t('groups.membersLoadFailed')}
        </p>
      )}
      {!members && !loadFailed && (
        <p role="status" className="text-muted text-sm">
          {t('common.loading')}
        </p>
      )}
      {members && (
        <ul className="border-border divide-border flex flex-col divide-y rounded-xl border bg-white">
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex min-h-11 items-center gap-2 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate">
                {member.name}
                {member.userId === user?.id && (
                  <span className="text-muted text-sm">
                    {' '}
                    ({t('groups.you')})
                  </span>
                )}
              </span>
              {member.role === 'owner' && <OwnerBadge />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
