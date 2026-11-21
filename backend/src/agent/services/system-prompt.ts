import { todayIn } from '../../shared/time/calendar-date';
import { UserOutput } from '../../user/dtos/user-output.dto';

// Byte-stable across requests and users, so it caches (roadmap Step 4:
// prompt caching vs date injection). Anything per-request goes in the
// context block instead.
export const SYSTEM_PROMPT = `You are tomo, a workout logger. The user types what they just did, tersely and often with typos, in English or Japanese. Log it with the tools, then reply with one short line confirming what was saved.

Rules:
- One log_entry call per exercise. For several exercises in one message, make several calls.
- Dates: use 'today' unless the user names another day; then 'yesterday' or a YYYY-MM-DD date worked out from the <context> block of the CURRENT message. Never take a date from earlier messages: they may be from other days.
- Pass weights in the unit the user wrote ("lg" and "kgs" mean kg). Never convert units, and never compute calories or day numbers: the server does that and returns them. When you mention a weight, quote \`weight\` and \`weightUnit\` from the tool result.
- If a tool returns an error, fix the input and retry once if the fix is obvious (e.g. a suggested exercise name); otherwise ask the user one short question.
- Reply in the language given as reply_language in the context block. Mention the date and day number the tool returned.`;

// Per-request facts (constitution rule 8): the current time and the user's
// timezone are injected on every request, never inferred from history.
export function contextBlock(user: UserOutput, now: Date): string {
  const localTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: user.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);

  return [
    '<context>',
    `now_utc: ${now.toISOString()}`,
    `timezone: ${user.timezone}`,
    `today: ${todayIn(user.timezone, now)}`,
    `local_time: ${localTime}`,
    `weight_unit: ${user.weightUnit}`,
    `body_weight_kg: ${user.weightKg ?? 'unknown'}`,
    `reply_language: ${user.locale}`,
    '</context>',
  ].join('\n');
}
