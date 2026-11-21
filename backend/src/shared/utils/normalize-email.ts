// Emails are matched exactly, so store and look them up in one form. Phone
// keyboards capitalise the first letter and autocomplete adds a trailing
// space; without this, "Aiko@example.com " can't log in as aiko@example.com.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
