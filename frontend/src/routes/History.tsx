import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { formatDay } from '../entries/format';
import { useI18n } from '../i18n/i18n-context';
import { dayControllerList } from '../lib/generated/days/days';
import type {
  DayDetailOutput,
  SwaggerBaseApiResponseForDayDetailOutputArray,
} from '../lib/generated/models';

const PAGE_SIZE = 30;

async function fetchDays(to?: string): Promise<DayDetailOutput[]> {
  // `to` is inclusive, so ask for one extra and drop the overlap.
  const res = await dayControllerList(
    to ? { to, limit: PAGE_SIZE + 1 } : { limit: PAGE_SIZE },
  );
  return (res.data as SwaggerBaseApiResponseForDayDetailOutputArray).data;
}

// Training days, newest first. Each opens the day to edit or delete entries.
export default function History() {
  const { t } = useI18n();
  const [days, setDays] = useState<DayDetailOutput[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0); // bump to retry

  useEffect(() => {
    let current = true;
    fetchDays()
      .then((page) => {
        if (!current) return;
        setDays(page);
        setHasMore(page.length === PAGE_SIZE);
        setStatus('ready');
      })
      .catch(() => current && setStatus('error'));
    return () => {
      current = false;
    };
  }, [attempt]);

  async function loadMore() {
    const oldest = days[days.length - 1];
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const page = await fetchDays(oldest.date);
      const known = new Set(days.map((d) => d.date));
      const older = page.filter((d) => !known.has(d.date));
      setDays((all) => [...all, ...older]);
      setHasMore(page.length > PAGE_SIZE);
    } catch {
      // The button stays; tapping it again retries.
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t('history.title')}</h1>

      {status === 'loading' && (
        <p role="status" className="text-muted">
          {t('common.loading')}
        </p>
      )}
      {status === 'error' && (
        <div role="alert" className="flex items-center gap-3 text-sm">
          <span className="text-red-700">{t('history.loadFailed')}</span>
          <button
            type="button"
            onClick={() => {
              setStatus('loading');
              setAttempt((a) => a + 1);
            }}
            className="text-accent min-h-11 cursor-pointer font-medium"
          >
            {t('chat.retry')}
          </button>
        </div>
      )}
      {status === 'ready' && days.length === 0 && (
        <p className="text-muted">{t('history.empty')}</p>
      )}

      <ul className="flex flex-col gap-2">
        {days.map((day) => (
          <li key={day.date}>
            <DayRow day={day} />
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="text-accent min-h-11 cursor-pointer self-center text-sm disabled:opacity-50"
        >
          {loadingMore ? t('common.loading') : t('history.loadMore')}
        </button>
      )}
    </section>
  );
}

function DayRow({ day }: { day: DayDetailOutput }) {
  const { t, locale } = useI18n();
  const names = [
    ...new Set(
      day.entries.map((e) =>
        locale === 'ja' && e.exercise.nameJa
          ? e.exercise.nameJa
          : e.exercise.name,
      ),
    ),
  ];
  return (
    <Link
      to={`/history/${day.date}`}
      className="border-border hover:border-accent flex min-h-14 items-center gap-3 rounded-xl border bg-white px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          {day.dayNumber !== null && (
            <span className="font-semibold">
              {t('entry.day', { n: day.dayNumber })}
            </span>
          )}
          <span className="text-muted text-sm">
            {formatDay(day.date, locale)}
          </span>
        </p>
        <p className="truncate text-sm">{names.join(', ')}</p>
      </div>
      {day.totalKcal > 0 && (
        <span className="text-muted shrink-0 text-xs">
          {t('entry.kcalRough', { n: Math.round(day.totalKcal) })}
        </span>
      )}
    </Link>
  );
}
