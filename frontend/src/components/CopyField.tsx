import { useRef, useState } from 'react';

import { useI18n } from '../i18n/i18n-context';

// A read-only value with a Copy button. Where the clipboard API isn't
// available (an insecure context, e.g. a phone over the LAN) the text is
// selected instead, ready for a manual copy.
export default function CopyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      input.current?.select();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={input}
        readOnly
        aria-label={label}
        value={value}
        onFocus={(e) => e.target.select()}
        className="border-border bg-background min-h-11 min-w-0 flex-1 rounded-lg border px-3 font-mono text-sm"
      />
      <button
        type="button"
        onClick={() => void copy()}
        className="border-border min-h-11 shrink-0 cursor-pointer rounded-lg border px-3 text-sm"
      >
        {copied ? t('common.copied') : t('common.copy')}
      </button>
    </div>
  );
}
