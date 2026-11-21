// After sign-in, go back where the visitor was headed, but only to a path
// on this site (never an open redirect to another origin).
export function safeRedirect(from: string | null): string {
  return from && from.startsWith('/') && !from.startsWith('//') ? from : '/';
}
