import { useTranslation } from 'react-i18next'
import { isAppLanguage, setLanguage } from '@/i18n'
import { NATIVE_NAMES, SUPPORTED_LANGUAGES } from '@/i18n/resources'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const current = isAppLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en'

  return (
    <select
      aria-label={t('common.language')}
      value={current}
      onChange={(event) => {
        if (isAppLanguage(event.target.value)) {
          setLanguage(event.target.value)
        }
      }}
      className="rounded-lg border-0 bg-white py-1.5 ps-3 pe-8 text-sm text-slate-700 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand"
    >
      {SUPPORTED_LANGUAGES.map((code) => (
        <option key={code} value={code}>
          {NATIVE_NAMES[code]}
        </option>
      ))}
    </select>
  )
}
