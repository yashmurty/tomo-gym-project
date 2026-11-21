import type { Locale } from '../i18n/i18n';
import type { EntryResult } from './entry-result';

const intlLocale = (locale: Locale) => (locale === 'ja' ? 'ja-JP' : 'en');

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Sets in gym notation, with the server's weights in the user's unit:
 *   uniform            → "2 × 10 @ 47 kg"
 *   reps vary          → "10/8/6 @ 40 kg"
 *   weights vary       → "10/8/6 @ 40/45/50 kg"
 *   no weights         → "3 × 10"
 * Returns null when there are no sets (cardio, holds).
 */
export function formatSets(
  entry: Pick<EntryResult, 'sets' | 'weightUnit'>,
  locale: Locale,
): string | null {
  const { sets } = entry;
  if (sets.length === 0) return null;
  const n = (v: number) => formatNumber(v, locale);
  const reps = sets.map((s) => s.reps);
  const weights = sets.map((s) => s.weight);
  const sameReps = reps.every((r) => r === reps[0]);
  const sameWeight = weights.every((w) => w === weights[0]);

  const repsPart =
    sameReps && sameWeight ? `${sets.length} × ${reps[0]}` : reps.join('/');
  if (weights.every((w) => w === null)) return repsPart;
  const weightPart = sameWeight
    ? n(weights[0]!)
    : weights.map((w) => (w === null ? '–' : n(w))).join('/');
  return `${repsPart} @ ${weightPart} ${entry.weightUnit}`;
}

// A workout day ('YYYY-MM-DD', a calendar date with no time zone) for
// display: "Thu, Nov 19" / "11月19日(木)". Formatted in UTC so the date
// can't shift with the device's time zone.
export function formatDay(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}
