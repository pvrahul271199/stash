export const MAX_NAME = 24;

/** Returns a gentle error message, or null if the name is fine. */
export function validateName(raw: string, existing: string[]): string | null {
  const name = raw.trim();
  if (!name) return 'Give it a name first.';
  if (name.length > MAX_NAME) return `Keep it to ${MAX_NAME} characters or less.`;
  if (existing.some((e) => e.trim().toLowerCase() === name.toLowerCase())) return 'That one already exists.';
  return null;
}
