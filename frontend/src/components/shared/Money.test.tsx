import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { Money } from './Money'

const plain = (el: HTMLElement) => (el.textContent ?? '').replace(/[\s\u00a0\u202f]/g, ' ')

describe('Money', () => {
  it('shows minor units as an amount in the currency of the group', () => {
    render(<Money minor={123450} currency="MAD" />)

    expect(plain(screen.getByText(/1,234\.50/))).toBe('MAD 1,234.50')
  })

  it('colours a balance green when it is to be received, red when it is owed, neutral when settled', () => {
    render(
      <>
        <Money minor={25333} currency="MAD" tone="balance" />
        <Money minor={-25333} currency="MAD" tone="balance" />
        <Money minor={0} currency="MAD" tone="balance" />
      </>,
    )

    expect(screen.getByText(/^MAD.253\.33$/)).toHaveClass('text-credit')
    expect(screen.getByText(/^-MAD.253\.33$/)).toHaveClass('text-debt')
    expect(screen.getByText(/^MAD.0\.00$/)).toHaveClass('text-slate-600')
  })

  it('colours debts red only while there is something owed', () => {
    render(
      <>
        <Money minor={500} currency="MAD" tone="debt" />
        <Money minor={0} currency="MAD" tone="debt" />
      </>,
    )

    expect(screen.getByText(/^MAD.5\.00$/)).toHaveClass('text-debt')
    expect(screen.getByText(/^MAD.0\.00$/)).not.toHaveClass('text-debt')
  })

  it('uses the separators of the language, and is always read left-to-right (also in Arabic)', async () => {
    await i18n.changeLanguage('fr')
    const { rerender } = render(<Money minor={123450} currency="MAD" />)
    expect(plain(screen.getByText(/1.234,50/))).toBe('1 234,50 MAD')

    await i18n.changeLanguage('ar')
    rerender(<Money minor={123450} currency="MAD" />)
    expect(screen.getByText(/1.234/).closest('bdi')).toHaveAttribute('dir', 'ltr')
  })
})
