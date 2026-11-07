import { describe, expect, it } from 'vitest'
import i18n, { setLanguage } from '@/i18n'
import { resources } from './resources'

function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix]
  }
  return Object.entries(value).flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key))
}

describe('translations', () => {
  it('have exactly the same keys in every language, so no screen ever shows a raw key', () => {
    const english = keysOf(resources.en.translation).sort()

    expect(keysOf(resources.fr.translation).sort()).toEqual(english)
    expect(keysOf(resources.ar.translation).sort()).toEqual(english)
  })

  it('keep the interpolation placeholders of the reference language', () => {
    expect(resources.fr.translation.join.expires).toContain('{{date}}')
    expect(resources.ar.translation.join.expires).toContain('{{date}}')
  })

  it('switch the document language and direction: Arabic is right-to-left', async () => {
    setLanguage('ar')
    await i18n.changeLanguage('ar')
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')

    setLanguage('fr')
    await i18n.changeLanguage('fr')
    expect(document.documentElement.dir).toBe('ltr')
    expect(localStorage.getItem('qisma.lang')).toBe('fr')
  })
})

describe('adoptPreferredLanguage: the language of the account, for a device that never chose one', () => {
  it('applies the language of the account when this device has no choice', async () => {
    const { adoptPreferredLanguage } = await import('./index')
    localStorage.clear()

    adoptPreferredLanguage('FR')

    expect(i18n.language).toBe('fr')
  })

  it('never overrides a language this device chose', async () => {
    const { adoptPreferredLanguage } = await import('./index')
    localStorage.setItem('qisma.lang', 'en')

    adoptPreferredLanguage('AR')

    expect(i18n.language).toBe('en')
  })

  it('does not remember it as a device choice, so a later change of the account language is followed', async () => {
    const { adoptPreferredLanguage } = await import('./index')
    localStorage.clear()

    adoptPreferredLanguage('FR')

    expect(localStorage.getItem('qisma.lang')).toBeNull()
  })

  it('ignores a language the app does not know', async () => {
    const { adoptPreferredLanguage } = await import('./index')
    localStorage.clear()

    adoptPreferredLanguage('XX')
    adoptPreferredLanguage('')

    expect(i18n.language).toBe('en')
  })
})
