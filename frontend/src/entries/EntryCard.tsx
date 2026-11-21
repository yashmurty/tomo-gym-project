import { useI18n } from '../i18n/i18n-context';
import type { EntryResult } from './entry-result';
import { formatDay, formatNumber, formatSets } from './format';

// One saved entry, as the server returned it. `showDate` is off where the
// page already says which day it is.
export default function EntryCard({
  entry,
  updated = false,
  showDate = true,
}: {
  entry: EntryResult;
  updated?: boolean;
  showDate?: boolean;
}) {
  const { t, locale } = useI18n();
  const n = (v: number) => formatNumber(v, locale);
  const name =
    locale === 'ja' && entry.exerciseJa ? entry.exerciseJa : entry.exercise;

  const details = [
    formatSets(entry, locale),
    entry.durationMin !== null &&
      t('entry.minutes', { n: n(entry.durationMin) }),
    entry.distanceKm !== null &&
      t('entry.distance', { n: n(entry.distanceKm) }),
    entry.speedKmh !== null && t('entry.speed', { n: n(entry.speedKmh) }),
    entry.inclinePct !== null && t('entry.incline', { n: n(entry.inclinePct) }),
  ].filter(Boolean);

  const meta = [
    entry.dayNumber !== undefined && t('entry.day', { n: entry.dayNumber }),
    showDate && formatDay(entry.date, locale),
    entry.estKcal !== null &&
      t(entry.kcalIsRough ? 'entry.kcalRough' : 'entry.kcal', {
        n: Math.round(entry.estKcal),
      }),
  ].filter(Boolean);

  return (
    <div className="border-border rounded-xl border bg-white px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-medium">{name}</span>
        {updated && (
          <span className="text-accent shrink-0 text-xs font-medium">
            {t('entry.updated')}
          </span>
        )}
      </div>
      {details.length > 0 && <p className="text-sm">{details.join(' · ')}</p>}
      {meta.length > 0 && (
        <p className="text-muted text-xs">{meta.join(' · ')}</p>
      )}
    </div>
  );
}
