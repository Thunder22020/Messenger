export function resolveDisplayName(username: string, displayName?: string | null): string {
  return displayName ?? username;
}
