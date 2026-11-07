/** The address a person opens to join: the join page of this very site, with the secret in the path. */
export function invitationLink(origin: string, secret: string): string {
  return `${origin}/join/${encodeURIComponent(secret)}`
}

/** Copies text to the clipboard. Returns false when the browser refuses (no permission, an insecure page). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** The options offered for how long an invitation stays valid. The server allows 1 to 30 days. */
export const EXPIRY_CHOICES = [1, 3, 7, 14, 30] as const
export const DEFAULT_EXPIRY_DAYS = 7
export const DEFAULT_MAX_USES = 5
export const MAX_USES_LIMIT = 50
