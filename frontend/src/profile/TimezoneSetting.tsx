import { useMemo, useState } from 'react';

import { useI18n } from '../i18n/i18n-context';
import { useAuth } from '../lib/auth-context';
import type { UserOutput } from '../lib/generated/models';

function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// The IANA zones this browser knows, plus the saved one in case the server
// stored an alias the browser lists under another name (Asia/Kolkata vs
// Asia/Calcutta): timezones are stored exactly as sent.
function zoneOptions(current: string): string[] {
  const zones = Intl.supportedValuesOf('timeZone');
  return zones.includes(current) ? zones : [current, ...zones];
}

// Which day "today" is when the user logs.
export default function TimezoneSetting({ profile }: { profile: UserOutput }) {
  const { t } = useI18n();
  const { updateProfile } = useAuth();
  const [failed, setFailed] = useState(false);
  const [device] = useState(deviceTimezone);
  const options = useMemo(
    () => zoneOptions(profile.timezone),
    [profile.timezone],
  );

  async function save(timezone: string) {
    setFailed(false);
    try {
      await updateProfile({ timezone });
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="block">
        <span className="sr-only">{t('profile.timezone')}</span>
        <select
          value={profile.timezone}
          onChange={(e) => void save(e.target.value)}
          className="border-border focus:border-accent min-h-11 w-full rounded-lg border bg-white px-3 text-base focus:outline-none"
        >
          {options.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </label>
      <p className="text-muted text-sm">{t('profile.timezoneHint')}</p>
      {device !== profile.timezone && (
        <button
          type="button"
          onClick={() => void save(device)}
          className="text-accent min-h-11 cursor-pointer self-start text-sm font-medium"
        >
          {t('profile.useDeviceTimezone', { timezone: device })}
        </button>
      )}
      {failed && (
        <p role="alert" className="text-sm text-red-700">
          {t('profile.saveFailed')}
        </p>
      )}
    </div>
  );
}
