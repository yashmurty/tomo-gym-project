import { useState } from 'react';

import { useI18n } from '../i18n/i18n-context';

// The message box, pinned above the tab bar within thumb reach.
export default function Composer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const [text, setText] = useState('');

  function submit() {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText('');
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="border-border bg-background fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-10 border-t"
    >
      <div className="mx-auto flex max-w-[640px] items-end gap-2 px-4 py-2">
        <label htmlFor="chat-input" className="sr-only">
          {t('chat.inputLabel')}
        </label>
        <textarea
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a new line. While an IME is
            // composing (Japanese input), Enter confirms the conversion:
            // never send then. Safari reports that as keyCode 229.
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing &&
              e.keyCode !== 229
            ) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={2000}
          enterKeyHint="send"
          autoComplete="off"
          placeholder={t('chat.placeholder')}
          className="border-border focus:border-accent [field-sizing:content] max-h-32 min-h-11 flex-1 resize-none rounded-xl border px-3 py-2.5 focus:outline-none"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="bg-accent hover:bg-accent-hover min-h-11 shrink-0 cursor-pointer rounded-xl px-4 font-medium text-white disabled:opacity-50"
        >
          {t('chat.send')}
        </button>
      </div>
    </form>
  );
}
