/**
 * The access token lives in memory only: never in localStorage or a cookie JavaScript can read, so an injected
 * script cannot steal a long-lived credential. A page reload gets a new one from the HttpOnly refresh cookie.
 */
let accessToken: string | null = null

export const tokenStore = {
  get: (): string | null => accessToken,
  set: (token: string | null): void => {
    accessToken = token
  },
}
