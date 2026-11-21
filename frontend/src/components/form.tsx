import type { ReactNode } from 'react';

// Shared form pieces for the auth screens. Inputs are 44px+ tall and 16px
// text, so iOS doesn't zoom in on focus.
export const inputClass =
  'border-border focus:border-accent min-h-11 w-full rounded-lg border px-3 py-2 text-base focus:outline-none';

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  // Hint and error sit outside the <label>, so the field's accessible name
  // is just its label.
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{label}</span>
        {children}
      </label>
      {hint && !error && <p className="text-muted mt-1 text-sm">{hint}</p>}
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900"
    >
      {children}
    </div>
  );
}

export function SubmitButton({
  busy,
  label,
  busyLabel,
}: {
  busy: boolean;
  label: string;
  busyLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="bg-accent hover:bg-accent-hover min-h-12 w-full cursor-pointer rounded-lg px-4 font-medium text-white disabled:opacity-50"
    >
      {busy ? busyLabel : label}
    </button>
  );
}
