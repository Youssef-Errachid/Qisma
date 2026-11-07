import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { type AppLanguage, RTL_LANGUAGES, SUPPORTED_LANGUAGES, resources } from './resources'

const STORAGE_KEY = 'qisma.lang'

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

function initialLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isAppLanguage(saved)) {
      return saved
    }
  } catch {
    // storage can be unavailable (private mode): fall through to the browser language
  }
  const browser = (typeof navigator === 'undefined' ? '' : navigator.language).slice(0, 2).toLowerCase()
  return isAppLanguage(browser) ? browser : 'fr'
}

/** Keeps <html lang> and <html dir> in step with the language, so Arabic is laid out right-to-left. */
function applyToDocument(language: string): void {
  document.documentElement.lang = language
  document.documentElement.dir = (RTL_LANGUAGES as readonly string[]).includes(language) ? 'rtl' : 'ltr'
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', applyToDocument)
applyToDocument(i18n.language)

/** The user's explicit choice is remembered on this device (a language is not sensitive data). */
export function setLanguage(language: AppLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // not being able to remember the choice is not worth failing for
  }
  void i18n.changeLanguage(language)
}

export default i18n
