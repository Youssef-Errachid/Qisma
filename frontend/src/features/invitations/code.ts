/**
 * What a person can hand over to join a group: a short code ("ABCD-EFGH", 8 symbols) or a long link secret, and
 * often the whole link pasted from a message. The server normalises codes the same way (no dash or spaces, upper case).
 */

const CODE_LENGTH = 8
const CODE_ALPHABET = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/

/** Pulls the secret out of a pasted invitation link, or returns null when the text is not such a link. */
function secretFromLink(text: string): string | null {
  const match = /\/join\/([^/?#\s]+)/.exec(text)
  if (!match) {
    return null
  }
  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

/** The value to send to the API, or null when what was typed cannot be an invitation. */
export function parseInvitationInput(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }
  const fromLink = secretFromLink(trimmed)
  if (fromLink) {
    return parseInvitationInput(fromLink)
  }
  const compact = trimmed.replace(/[-\s]/g, '')
  if (compact.length <= CODE_LENGTH) {
    const code = compact.toUpperCase()
    return code.length === CODE_LENGTH && CODE_ALPHABET.test(code) ? code : null
  }
  // longer than a code: a link secret, which is opaque and is sent exactly as it came
  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null
}

/** "abcd efgh" shown as "ABCD-EFGH" while typing. Anything longer than a code is left alone. */
export function formatCodeInput(input: string): string {
  const compact = input.replace(/[-\s]/g, '')
  if (compact.length > CODE_LENGTH || /[^A-Za-z0-9]/.test(compact)) {
    return input
  }
  const upper = compact.toUpperCase()
  return upper.length > CODE_LENGTH / 2 ? `${upper.slice(0, CODE_LENGTH / 2)}-${upper.slice(CODE_LENGTH / 2)}` : upper
}
