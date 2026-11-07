/** Maps the app's language to the locale used for dates and numbers (Arabic uses Western digits, as in Morocco). */
export function localeFor(language: string): string {
  if (language === 'ar') return 'ar-MA'
  if (language === 'fr') return 'fr-FR'
  return 'en-GB'
}

export function formatDate(iso: string, language: string): string {
  return new Intl.DateTimeFormat(localeFor(language), { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso))
}

export function formatDateTime(iso: string, language: string): string {
  return new Intl.DateTimeFormat(localeFor(language), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

/** "Moroccan Dirham" in the user's language; falls back to the bare code when the runtime does not know it. */
export function currencyName(code: string, language: string): string {
  try {
    return new Intl.DisplayNames([localeFor(language)], { type: 'currency' }).of(code) ?? code
  } catch {
    return code
  }
}
