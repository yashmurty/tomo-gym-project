import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { formatDay } from '../entries/format';
import DayNote from '../history/DayNote';
import EntryItem from '../history/EntryItem';
import { useI18n } from '../i18n/i18n-context';
import { dayControllerGet } from '../lib/generated/days/days';
import type {
  DayDetailOutput,
  SwaggerBaseApiResponseForDayDetailOutput,
} from '../lib/generated/models';

// One day in full: note, entries, edit and delete.
export default function Day() {
  const { t, locale } = useI18n();
  const { date = '' } = useParams();
  const [day, setDay] = useState<DayDetailOutput | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

  const [version, setVersion] = useState(0); // bump to reload after edits

  useEffect(() => {
    let current = true;
    dayControllerGet(date)
      .then((res) => {
        if (!current) return;
        setDay((res.data as SwaggerBaseApiResponseForDayDetailOutput).data);
        setStatus('ready');
      })
      .catch(() => current && setStatus('error'));
    return () => {
      current = false;
    };
  }, [date, version]);

  return (
    <section className="flex flex-col gap-4">
      <Link
        to="/history"
        className="text-accent -my-2 inline-flex min-h-11 items-center self-start text-sm"
      >
        ‹ {t('history.back')}
      </Link>

      {status === 'loading' && (
        <p role="status" className="text-muted">
          {t('common.loading')}
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="text-red-700">
          {t('history.dayLoadFailed')}
        </p>
      )}

      {day && (
        <>
          <header>
            <h1 className="text-2xl font-semibold">
              {day.dayNumber !== null
                ? t('entry.day', { n: day.dayNumber })
                : formatDay(day.date, locale)}
            </h1>
            <p className="text-muted text-sm">
              {[
                day.dayNumber !== null && formatDay(day.date, locale),
                day.totalKcal > 0 &&
                  t('entry.kcalRough', { n: Math.round(day.totalKcal) }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </header>

          <DayNote key={day.note ?? ''} day={day} onSaved={setDay} />

          {day.entries.length === 0 ? (
            <p className="text-muted">{t('history.dayEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {day.entries.map((entry) => (
                <li key={`${entry.id}-${entry.updatedAt}`}>
                  <EntryItem
                    entry={entry}
                    onChanged={() => setVersion((v) => v + 1)}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
