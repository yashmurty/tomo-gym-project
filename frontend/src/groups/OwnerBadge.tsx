import { useI18n } from '../i18n/i18n-context';

export default function OwnerBadge() {
  const { t } = useI18n();
  return (
    <span className="bg-background text-muted shrink-0 rounded-full px-2 py-0.5 text-xs">
      {t('groups.owner')}
    </span>
  );
}
